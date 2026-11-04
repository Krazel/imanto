import XCTest
@testable import Imanto

@MainActor final class ConsentPreparationTests: XCTestCase {
    func testLaunchAndAdRequestsShareOneConsentOperation() {
        let preparation = ConsentPreparation()
        var finish: ((Bool) -> Void)?
        var operations = 0
        var answers: [Bool] = []
        preparation.run({ operations += 1; finish = $0 }, completion: { answers.append($0) })
        preparation.run({ _ in operations += 1 }, completion: { answers.append($0) })
        XCTAssertEqual(operations, 1)
        XCTAssertTrue(answers.isEmpty)
        finish?(true)
        XCTAssertEqual(answers, [true, true])
        XCTAssertFalse(preparation.running)
    }
    func testFailedConsentCanRetryWithoutOpeningPrivacySettings() {
        let preparation = ConsentPreparation()
        var answers: [Bool] = []
        preparation.run({ $0(false) }, completion: { answers.append($0) })
        preparation.run({ $0(true) }, completion: { answers.append($0) })
        XCTAssertEqual(answers, [false, true])
    }
    func testLateDuplicateCallbackCannotFinishTheNextTransaction() {
        let preparation = ConsentPreparation()
        var first: ((Bool) -> Void)?, second: ((Bool) -> Void)?
        var answers: [Bool] = []
        preparation.run({ first = $0 }, completion: { answers.append($0) })
        first?(false)
        preparation.run({ second = $0 }, completion: { answers.append($0) })
        first?(true)
        XCTAssertTrue(preparation.running)
        XCTAssertEqual(answers, [false])
        second?(true)
        XCTAssertEqual(answers, [false, true])
    }
}
