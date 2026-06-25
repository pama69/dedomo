"""End-to-end backend tests for Ospitalo (vacation rental guest data tool)."""
import base64
import io
import pytest


# ----- Health & Auth -----

class TestHealthAndAuth:
    def test_root_endpoint(self, anon_client, base_url):
        r = anon_client.get(f"{base_url}/api/")
        assert r.status_code == 200
        data = r.json()
        assert data.get("app") == "Ospitalo"
        assert data.get("status") == "ok"

    def test_auth_me_unauthenticated(self, anon_client, base_url):
        r = anon_client.get(f"{base_url}/api/auth/me")
        assert r.status_code == 401

    def test_auth_login_invalid(self, anon_client, base_url):
        # Login con credenziali inesistenti -> 401
        r = anon_client.post(
            f"{base_url}/api/auth/login",
            json={"email": "nonexistent@example.com", "password": "wrongpassword"},
        )
        assert r.status_code == 401

    def test_auth_me_authenticated(self, api_client, base_url, seeded_session):
        r = api_client.get(f"{base_url}/api/auth/me")
        assert r.status_code == 200
        data = r.json()
        assert data["user_id"] == seeded_session["user_id"]
        assert "@example.com" in data["email"]


# ----- Properties CRUD -----

PROPERTY_PAYLOAD = {
    "nome": "TEST_Casa Ospitalo",
    "indirizzo": "Via Roma 1",
    "comune": "Pescara",
    "provincia": "PE",
    "cap": "65100",
    "cin": "IT065100C2T1234567",
    "tipologia": "Casa Vacanza",
    "mode": "TEST",
    "alloggiati": {
        "utente": "FAKE_USER",
        "password": "FAKE_PASS",
        "ws_key": "FAKE_KEY",
        "enabled": True,
    },
    "ross1000": {
        "regione": "Abruzzo",
        "utente": "",
        "password": "",
        "endpoint_url": "",
        "format": "csv_manual",
        "codice_struttura": "STR001",
        "enabled": True,
    },
    "imposta_soggiorno": {
        "tariffa_per_notte": 2.5,
        "max_notti_tassabili": 5,
        "esenti_under_anni": 12,
        "endpoint_comune": "",
        "enabled": True,
    },
}


class TestPropertiesCRUD:
    def test_create_property(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/properties", json=PROPERTY_PAYLOAD)
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["nome"] == "TEST_Casa Ospitalo"
        assert p["mode"] == "TEST"
        assert p["alloggiati"]["enabled"] is True
        assert p["ross1000"]["format"] == "csv_manual"
        assert p["imposta_soggiorno"]["tariffa_per_notte"] == 2.5
        assert "property_id" in p and p["property_id"].startswith("prop_")
        pytest.shared_property_id = p["property_id"]

    def test_list_properties(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/properties")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        ids = [x["property_id"] for x in items]
        assert pytest.shared_property_id in ids

    def test_get_property(self, api_client, base_url):
        pid = pytest.shared_property_id
        r = api_client.get(f"{base_url}/api/properties/{pid}")
        assert r.status_code == 200
        assert r.json()["property_id"] == pid

    def test_update_property(self, api_client, base_url):
        pid = pytest.shared_property_id
        payload = {**PROPERTY_PAYLOAD, "nome": "TEST_Casa Ospitalo Updated"}
        r = api_client.put(f"{base_url}/api/properties/{pid}", json=payload)
        assert r.status_code == 200
        # Verify persistence
        g = api_client.get(f"{base_url}/api/properties/{pid}")
        assert g.json()["nome"] == "TEST_Casa Ospitalo Updated"

    def test_get_nonexistent_property(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/properties/prop_doesnotexist")
        assert r.status_code == 404

    def test_properties_unauthorized(self, anon_client, base_url):
        r = anon_client.get(f"{base_url}/api/properties")
        assert r.status_code == 401


# ----- OCR -----

# Tiny 1x1 PNG (white). Real document not required; we just check graceful behaviour.
_PNG_1x1 = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAfbLI3wAAAABJRU5ErkJggg=="
)


class TestOCR:
    def test_ocr_document_returns_structured_or_graceful_error(self, api_client, base_url):
        img_b64 = base64.b64encode(_PNG_1x1).decode()
        r = api_client.post(
            f"{base_url}/api/ocr/document",
            json={"image_base64": img_b64, "mime_type": "image/png"},
            timeout=60,
        )
        # Accept either 200 (parsed) or 500 (graceful failure for non-document)
        assert r.status_code in (200, 500), r.text
        if r.status_code == 200:
            data = r.json()
            # Expect at least the standard fields (may be empty strings)
            for k in ("cognome", "nome", "data_nascita"):
                assert k in data, f"missing key {k} in OCR response: {data}"

    def test_ocr_unauthorized(self, anon_client, base_url):
        r = anon_client.post(
            f"{base_url}/api/ocr/document",
            json={"image_base64": "x", "mime_type": "image/png"},
        )
        assert r.status_code == 401


# ----- Check-in submission -----

CHECKIN_PAYLOAD_BASE = {
    "data_arrivo": "2025-06-01",
    "data_partenza": "2025-06-04",  # 3 nights
    "guests": [
        {
            "cognome": "Rossi",
            "nome": "Mario",
            "sesso": "M",
            "data_nascita": "1990-05-15",
            "luogo_nascita": "Roma",
            "stato_nascita": "100000100",
            "cittadinanza": "100000100",
            "tipo_documento": "CARTA_IDENTITA",
            "numero_documento": "AB1234567",
            "stato_rilascio_documento": "100000100",
            "codice_comune_nascita": "H501",
        }
    ],
}


class TestCheckinSubmit:
    def test_checkin_submit_test_mode(self, api_client, base_url):
        payload = {"property_id": pytest.shared_property_id, **CHECKIN_PAYLOAD_BASE}
        r = api_client.post(f"{base_url}/api/checkin/submit", json=payload, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()

        assert data.get("test_mode") is True
        assert "checkin_id" in data
        pytest.shared_checkin_id = data["checkin_id"]

        # Alloggiati - allowed to fail auth (fake creds) but must return structured dict
        aw = data.get("alloggiati_web")
        assert isinstance(aw, dict)
        assert "success" in aw
        # With fake creds, expect success=False with a message (or, if validated, success=True)
        if aw["success"] is False:
            assert aw.get("message") or aw.get("skipped")

        # Ross 1000 - csv_manual should always succeed with csv_content
        ross = data.get("ross1000")
        assert isinstance(ross, dict)
        assert ross["success"] is True
        assert "csv_content" in ross and ross["csv_content"]

        # Imposta soggiorno - should compute
        imp = data.get("imposta_soggiorno")
        assert isinstance(imp, dict)
        assert imp["success"] is True
        calc = imp["calculation"]
        # 3 nights, tariffa 2.5, adult guest -> 7.5
        assert calc["nights"] == 3
        assert calc["notti_tassabili"] == 3
        assert calc["totale_imposta"] == 7.5
        assert len(calc["breakdown"]) == 1
        assert calc["breakdown"][0]["esente"] is False

    def test_checkin_submit_invalid_property(self, api_client, base_url):
        payload = {"property_id": "prop_doesnotexist", **CHECKIN_PAYLOAD_BASE}
        r = api_client.post(f"{base_url}/api/checkin/submit", json=payload)
        assert r.status_code == 404

    def test_tax_calculation_with_minor_exempt(self, api_client, base_url):
        # Add a child under 12 -> should be exempt
        guests = list(CHECKIN_PAYLOAD_BASE["guests"]) + [
            {
                "cognome": "Rossi",
                "nome": "Giulia",
                "sesso": "F",
                "data_nascita": "2018-04-10",  # ~7 years on 2025-06-01
                "luogo_nascita": "Roma",
                "stato_nascita": "100000100",
                "cittadinanza": "100000100",
                "tipo_documento": "CARTA_IDENTITA",
                "numero_documento": "",
                "stato_rilascio_documento": "100000100",
                "codice_comune_nascita": "H501",
            }
        ]
        payload = {
            "property_id": pytest.shared_property_id,
            "data_arrivo": "2025-06-01",
            "data_partenza": "2025-06-04",
            "guests": guests,
        }
        r = api_client.post(f"{base_url}/api/checkin/submit", json=payload, timeout=60)
        assert r.status_code == 200, r.text
        calc = r.json()["imposta_soggiorno"]["calculation"]
        # adult 7.5, child 0 -> total 7.5
        assert calc["totale_imposta"] == 7.5
        assert len(calc["breakdown"]) == 2
        minor = [b for b in calc["breakdown"] if b["nome"] == "Giulia"][0]
        assert minor["esente"] is True
        assert minor["totale_ospite"] == 0
        assert minor["eta"] is not None and minor["eta"] < 12


# ----- Archive & downloads -----

class TestArchiveAndDownloads:
    def test_list_checkins(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/checkins")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        ids = [c["checkin_id"] for c in items]
        assert pytest.shared_checkin_id in ids

    def test_get_checkin(self, api_client, base_url):
        cid = pytest.shared_checkin_id
        r = api_client.get(f"{base_url}/api/checkins/{cid}")
        assert r.status_code == 200
        assert r.json()["checkin_id"] == cid

    def test_pdf_receipt_download(self, api_client, base_url):
        cid = pytest.shared_checkin_id
        r = api_client.get(f"{base_url}/api/checkins/{cid}/receipt-pdf")
        assert r.status_code == 200, r.text
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content[:4] == b"%PDF"

    def test_ross1000_csv_download(self, api_client, base_url):
        cid = pytest.shared_checkin_id
        r = api_client.get(f"{base_url}/api/checkins/{cid}/ross1000-csv")
        assert r.status_code == 200, r.text
        assert "text/csv" in r.headers.get("content-type", "")
        text = r.content.decode("utf-8", errors="replace")
        # Should contain CSV header line referring to movimenti
        assert "movimenti" in text.lower() or "data_arrivo" in text.lower() or "cognome" in text.lower()

    def test_alloggiati_ricevuta_test_mode_blocked(self, api_client, base_url):
        cid = pytest.shared_checkin_id
        # mode is TEST, must return 400
        r = api_client.get(f"{base_url}/api/checkins/{cid}/alloggiati-ricevuta")
        assert r.status_code == 400


# ----- Logout (last, to avoid invalidating the seeded session) -----

class TestLogout:
    def test_delete_property(self, api_client, base_url):
        pid = pytest.shared_property_id
        r = api_client.delete(f"{base_url}/api/properties/{pid}")
        assert r.status_code == 200
        assert r.json().get("success") is True

    def test_logout_clears_session(self, api_client, base_url, mongo_db, seeded_session):
        # Logout via Authorization header path: server only deletes if cookie present.
        # We pass token via cookie to validate cookie-clear path:
        token = seeded_session["token"]
        r = api_client.post(
            f"{base_url}/api/auth/logout",
            cookies={"session_token": token},
        )
        assert r.status_code == 200
        assert r.json().get("success") is True
        # Verify session was deleted from DB
        remaining = mongo_db.user_sessions.find_one({"session_token": token})
        assert remaining is None
