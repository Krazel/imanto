import Foundation
import StoreKit

// Installation-local limits explicitly requested by the owner. Reinstalling
// may reset usage. Only verified StoreKit purchases establish subscriptions.
struct LocalBenefitsState: Codable {
    var installedAt = Date()
    var eligibleTransactions = Set<String>()
    var debits = 0
    var day = ""
    var usedRevives = 0
    var claims: [String: String] = [:]
}
struct LocalBenefitsPeriod {
    let id: String
    let start: Date
    let end: Date
    let quota: Int
    let revoked: Bool
}
struct LocalBenefitsPolicy {
    static func balance(periods: [LocalBenefitsPeriod], debits: Int) -> Int {
        var cycles: [(end: Date, quota: Int)] = []
        for period in periods.sorted(by: { $0.start < $1.start }) {
            guard !period.revoked else { continue }
            if let index = cycles.indices.last, period.start < cycles[index].end {
                cycles[index].quota = max(cycles[index].quota, period.quota)
            } else { cycles.append((period.end, period.quota)) }
        }
        return max(0, cycles.reduce(0) { $0 + $1.quota } - debits)
    }
    static func day(_ date: Date) -> String {
        let format = DateFormatter(); format.locale = Locale(identifier: "en_US_POSIX")
        format.timeZone = TimeZone(identifier: "Europe/Madrid"); format.dateFormat = "yyyy-MM-dd"
        return format.string(from: date)
    }
    static func claim(state: inout LocalBenefitsState, gameID: String, kind: String,
                      balance: Int, plan: MembershipPlan?, now: Date) -> MembershipClaim? {
        guard !gameID.isEmpty, gameID.count <= 100, ["remove", "revive"].contains(kind) else { return nil }
        let key = kind + ":" + gameID
        if let receipt = state.claims[key] { return MembershipClaim(gameID: gameID, receipt: receipt) }
        let today = day(now)
        if state.day != today { state.day = today; state.usedRevives = 0 }
        if kind == "remove" {
            guard plan?.unlimited == true || balance > 0 else { return nil }
            if plan?.unlimited != true { state.debits += 1 }
        } else {
            guard let plan = plan else { return nil }
            if let limit = plan.dailyRevives, state.usedRevives >= limit { return nil }
            state.usedRevives += 1
        }
        let receipt = UUID().uuidString; state.claims[key] = receipt
        return MembershipClaim(gameID: gameID, receipt: receipt)
    }
}

@MainActor final class NativeWallet: MembershipWalletAuthority {
    private let defaults: UserDefaults
    private let storageKey = "imanto-local-subscription-benefits-v1"
    private var state: LocalBenefitsState
    private var periods: [LocalBenefitsPeriod] = []
    private var currentPlan: MembershipPlan?
    private let plans = MembershipConfiguration().plans
    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        if let data = defaults.data(forKey: storageKey), let saved = try? JSONDecoder().decode(LocalBenefitsState.self, from: data) { state = saved }
        else { state = LocalBenefitsState() }
        persist()
    }
    private func persist() {
        if let data = try? JSONEncoder().encode(state) { defaults.set(data, forKey: storageKey) }
    }
    func reconcile(signedTransactions: [String]) async throws -> MembershipWalletSnapshot {
        // Read StoreKit directly; JavaScript cannot supply a plan or balance.
        var activeIDs = Set<String>(); var active: [(Transaction, MembershipPlan)] = []
        for await result in Transaction.currentEntitlements {
            guard case .verified(let transaction) = result, transaction.revocationDate == nil,
                  !transaction.isUpgraded, let plan = plans.first(where: { $0.productID == transaction.productID }) else { continue }
            activeIDs.insert(String(transaction.id)); active.append((transaction, plan))
        }
        currentPlan = active.sorted { $0.0.purchaseDate > $1.0.purchaseDate }.first?.1
        periods = []
        for await result in Transaction.all {
            guard case .verified(let transaction) = result,
                  let plan = plans.first(where: { $0.productID == transaction.productID }),
                  let end = transaction.expirationDate else { continue }
            let id = String(transaction.id)
            if activeIDs.contains(id) || transaction.purchaseDate >= state.installedAt { state.eligibleTransactions.insert(id) }
            guard state.eligibleTransactions.contains(id), let quota = plan.monthlyRemovals else { continue }
            periods.append(LocalBenefitsPeriod(id: id, start: transaction.purchaseDate, end: end, quota: quota, revoked: transaction.revocationDate != nil))
        }
        let today = LocalBenefitsPolicy.day(Date())
        if state.day != today { state.day = today; state.usedRevives = 0 }
        persist()
        let remaining = currentPlan.map { max(0, ($0.dailyRevives ?? 0) - state.usedRevives) } ?? 0
        return MembershipWalletSnapshot(balance: LocalBenefitsPolicy.balance(periods: periods, debits: state.debits), revivesRemaining: remaining)
    }
    func claim(gameID: String, kind: String) async throws -> MembershipClaim? {
        _ = try await reconcile(signedTransactions: [])
        let result = LocalBenefitsPolicy.claim(state: &state, gameID: gameID, kind: kind,
            balance: LocalBenefitsPolicy.balance(periods: periods, debits: state.debits), plan: currentPlan, now: Date())
        persist(); return result
    }
}
