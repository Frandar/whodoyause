import pytest
from src.auth import AuthError, verify_token


def test_missing_header():
    with pytest.raises(AuthError):
        verify_token(None)


def test_empty_header():
    with pytest.raises(AuthError):
        verify_token("")


def test_non_bearer_header():
    with pytest.raises(AuthError):
        verify_token("Basic dXNlcjpwYXNz")


def test_malformed_token():
    with pytest.raises(AuthError):
        verify_token("Bearer not.a.valid.jwt")
