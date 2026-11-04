import Foundation

/// Coalesce launch, banner and rewarded requests into one consent transaction.
/// Failure clears the transaction so foreground/network retries can try again.
@MainActor final class ConsentPreparation {
    private var waiters: [(Bool) -> Void] = []
    private(set) var running = false
    private var transaction = 0
    func run(_ operation: (@escaping (Bool) -> Void) -> Void, completion: @escaping (Bool) -> Void) {
        waiters.append(completion)
        guard !running else { return }
        running = true
        transaction += 1
        let current = transaction
        operation { [weak self] allowed in
            guard let self = self, self.running, self.transaction == current else { return }
            let callbacks = self.waiters
            self.waiters.removeAll(); self.running = false
            callbacks.forEach { $0(allowed) }
        }
    }
}
