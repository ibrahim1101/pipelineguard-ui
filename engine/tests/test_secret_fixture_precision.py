from scanners.secret_scanner import scan_text


def test_known_synthetic_password_in_test_is_not_critical():
    assert scan_text('password: "test-password-long"', "src/lib/messaging.integration.test.ts") == []


def test_unknown_password_in_test_still_critical():
    findings = scan_text('password: "P7qR9vL2xM5nT8zK"', "src/lib/messaging.integration.test.ts")
    assert len(findings) == 1
    assert findings[0]["severity"] == "CRITICAL"


def test_synthetic_password_outside_test_still_detected():
    assert len(scan_text('password: "test-password-long"', "src/lib/auth.ts")) == 1


def test_high_confidence_token_in_test_still_detected():
    findings = scan_text('token: "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345"', "src/lib/auth.test.ts")
    assert any(f["rule"] == "GitHub token" for f in findings)
