import unittest
from fastapi.testclient import TestClient
from app.main import app

class TestAPIEndpoints(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_health_check(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data.get("status"), "healthy")
        self.assertIn("ai_provider", data)

    def test_list_documents(self):
        response = self.client.get("/api/v1/documents")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsInstance(data, list)

    def test_query_validation(self):
        response = self.client.post("/api/v1/query", json={})
        self.assertEqual(response.status_code, 422)

    def test_get_nonexistent_document(self):
        response = self.client.get("/api/v1/documents/non_existent_id_999999")
        self.assertEqual(response.status_code, 404)

if __name__ == "__main__":
    unittest.main()
