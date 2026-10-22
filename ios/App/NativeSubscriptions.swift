import UIKit
import WebKit
import StoreKit

struct MembershipPlan {
    let productID: String
    let monthlyRemovals: Int?
    let unlimited: Bool
    let dailyRevives: Int?
    var valid: Bool { unlimited ? monthlyRemovals == nil : (monthlyRemovals ?? 0) > 0 }
}
struct MembershipConfiguration {
    let enabled = true
    // Product IDs match the approved monthly catalogue in App Store Connect.
    let plans: [MembershipPlan] = [
        .init(productID: "com.krazel.imanto.monthly10", monthlyRemovals: 10, unlimited: false, dailyRevives: 0),
        .init(productID: "com.krazel.imanto.monthly20", monthlyRemovals: 20, unlimited: false, dailyRevives: 0),
        .init(productID: "com.krazel.imanto.monthly50", monthlyRemovals: 50, unlimited: false, dailyRevives: 0),
        .init(productID: "com.krazel.imanto.monthly80", monthlyRemovals: 80, unlimited: false, dailyRevives: 0),
        .init(productID: "com.krazel.imanto.unlimited", monthlyRemovals: nil, unlimited: true, dailyRevives: 0)
    ]
}
struct MembershipWalletSnapshot { let balance: Int; let revivesRemaining: Int }
struct MembershipClaim { let gameID: String; let receipt: String }

// StoreKit-verified benefits saved locally, as explicitly requested by the owner.
// Reinstalling may reset limits; no custom account or online benefits service.
@MainActor protocol MembershipWalletAuthority: AnyObject {
    func reconcile(signedTransactions: [String]) async throws -> MembershipWalletSnapshot
    // nil means confirmed zero balance/no debit; thrown errors are uncertain.
    func claim(gameID: String, kind: String) async throws -> MembershipClaim?
}

@MainActor final class NativeSubscriptions {
    weak var owner: GameController?
    let config = MembershipConfiguration()
    // Installation-local storage; simulator tests may provide a test authority.
    var wallet: MembershipWalletAuthority?
    private(set) var active = false
    private var unlimited = false
    private var resolved = false
    private var balance = 0
    private var revivesRemaining = 0
    private var walletReady = false
    private var products: [Product] = []
    private var listener: Task<Void, Never>?
    private var processing = false
    private var refreshWaiters: [CheckedContinuation<Void, Never>] = []
    private var operating = false
    var suppressAutomaticAds: Bool { config.enabled && (processing || !resolved || active) }
    init(owner: GameController) { self.owner = owner }
    deinit { listener?.cancel() }
    func start() {
        guard config.enabled, !config.plans.isEmpty, listener == nil else { return }
        listener = Task { [weak self] in
            for await result in Transaction.updates {
                guard let self = self else { return }
                if case .verified(let transaction) = result,
                   self.config.plans.contains(where: { $0.productID == transaction.productID }) {
                    // Finish only after the local storage acknowledges processing.
                    if let wallet = self.wallet,
                       (try? await wallet.reconcile(signedTransactions: [result.jwsRepresentation])) != nil {
                        await transaction.finish()
                    }
                    await self.refresh()
                    self.notify()
                }
            }
        }
        Task { await refresh(); notify() }
    }
    func refresh() async {
        guard config.enabled, !config.plans.isEmpty else { return }
        if processing {
            await withCheckedContinuation { refreshWaiters.append($0) }
            return
        }
        processing = true
        defer {
            processing = false
            let waiters = refreshWaiters; refreshWaiters.removeAll()
            for waiter in waiters { waiter.resume() }
        }
        let ids = Set(config.plans.map(\.productID))
        var entitled = false, unlimitedEntitlement = false, signed: [String] = [], verified: [Transaction] = []
        for await result in Transaction.currentEntitlements {
            guard case .verified(let transaction) = result, ids.contains(transaction.productID),
                  transaction.revocationDate == nil, !transaction.isUpgraded else { continue }
            // currentEntitlements determines access, including a configured grace
            // period. Do not replace it with a device-clock expiration test.
            entitled = true; signed.append(result.jwsRepresentation); verified.append(transaction)
            if config.plans.contains(where: { $0.productID == transaction.productID && $0.valid && $0.unlimited }) { unlimitedEntitlement = true }
        }
        active = entitled; unlimited = unlimitedEntitlement; resolved = true
        #if targetEnvironment(simulator)
        products = []
        #else
        products = (try? await Product.products(for: ids)) ?? []
        #endif
        if let wallet = wallet,
           let snapshot = try? await wallet.reconcile(signedTransactions: signed), snapshot.balance >= 0 {
            balance = snapshot.balance; revivesRemaining = snapshot.revivesRemaining; walletReady = true
            for transaction in verified { await transaction.finish() }
        } else { balance = 0; revivesRemaining = 0; walletReady = false }
        if active { owner?.ads?.hideBanner() }
    }
    private func snapshot() -> [String: Any] {
        let catalogue: [[String: Any]] = config.plans.compactMap { plan in
            guard let product = products.first(where: { $0.id == plan.productID }) else { return nil }
            guard product.type == .autoRenewable,
                  product.subscription?.subscriptionPeriod.unit == .month,
                  product.subscription?.subscriptionPeriod.value == 1,
                  plan.valid else { return nil }
            return ["id": product.id, "name": product.displayName, "price": product.displayPrice, "monthlyRemovals": plan.monthlyRemovals ?? 0, "unlimited": plan.unlimited, "dailyRevives": plan.dailyRevives ?? -1]
        }
        return ["resolved": resolved, "available": config.enabled && resolved && walletReady && !catalogue.isEmpty,
                "active": active, "unlimited": active && unlimited, "balance": balance, "revivesRemaining": revivesRemaining, "unlimitedRevives": false, "products": catalogue]
    }
    private func emit(_ values: [String: Any], event: String) {
        guard let data = try? JSONSerialization.data(withJSONObject: values),
              let json = String(data: data, encoding: .utf8) else { return }
        owner?.web?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('\(event)',{detail:\(json)}))", completionHandler: nil)
    }
    private func notify() { emit(snapshot(), event: "imanto-subscription-changed") }
    func receive(_ body: [String: Any]) {
        guard let id = body["requestId"] as? String, id.count < 100,
              let action = body["action"] as? String else { return }
        Task {
            var result: [String: Any] = ["ok": false, "reason": "unavailable"]
            if config.enabled, !config.plans.isEmpty, UIApplication.shared.applicationState == .active {
                if action == "status" { await refresh(); result = snapshot() }
                else if !operating {
                    operating = true
                    do {
                        switch action {
                        case "restore":
                            try await AppStore.sync(); await refresh(); result = ["ok": true]
                        case "manage":
                            if let scene = owner?.view.window?.windowScene {
                                try await AppStore.showManageSubscriptions(in: scene)
                                await refresh(); result = ["ok": true]
                            }
                        case "purchase":
                            await refresh()
                            if walletReady, let productID = body["productId"] as? String,
                               let product = products.first(where: { $0.id == productID }),
                               config.plans.contains(where: { $0.productID == productID && $0.valid }),
                               product.type == .autoRenewable,
                               product.subscription?.subscriptionPeriod.unit == .month,
                               product.subscription?.subscriptionPeriod.value == 1 {
                                switch try await product.purchase() {
                                case .success(let verification):
                                    guard case .verified(let transaction) = verification, let wallet = wallet else { break }
                                    _ = try await wallet.reconcile(signedTransactions: [verification.jwsRepresentation])
                                    await transaction.finish(); await refresh(); result = ["ok": true]
                                case .pending: result = ["ok": false, "reason": "pending"]
                                case .userCancelled: result = ["ok": false, "reason": "cancelled"]
                                @unknown default: break
                                }
                            }
                        case "claim":
                            if let gameID = body["gameId"] as? String, !gameID.isEmpty, gameID.count <= 100,
                               let kind = body["kind"] as? String, ["remove", "revive"].contains(kind), let wallet = wallet {
                                let claim = try await wallet.claim(gameID: gameID, kind: kind)
                                if let claim = claim {
                                    if claim.gameID == gameID, !claim.receipt.isEmpty {
                                        result = ["ok": true, "gameId": gameID, "receipt": claim.receipt]
                                        await refresh()
                                    }
                                } else {
                                    result = ["ok": false, "gameId": gameID, "reason": "no-balance", "confirmed": true]
                                    await refresh()
                                }
                            }
                        default: break
                        }
                    } catch { result = ["ok": false, "reason": "unavailable"] }
                    operating = false; notify()
                }
            }
            if action == "status", result["active"] == nil { result = snapshot() }
            result["requestId"] = id; emit(result, event: "imanto-subscription-result")
        }
    }
}
