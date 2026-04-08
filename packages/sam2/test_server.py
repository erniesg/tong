"""
Tests for SAM2 sidecar server.

Run: python3 -m pytest packages/sam2/test_server.py -v
Or:  cd packages/sam2 && python3 -m pytest test_server.py -v

Tests the FastAPI endpoints without requiring the full SAM2 model
by using the mock/lightweight mode.
"""

import base64
import io
import json
import pytest
from PIL import Image

# Create a test image (100x100 red square on white bg)
def make_test_image_b64(width=200, height=200):
    img = Image.new("RGB", (width, height), "white")
    # Draw a colored rectangle in center (simulates a subject)
    for x in range(50, 150):
        for y in range(50, 150):
            img.putpixel((x, y), (255, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


@pytest.fixture
def client():
    """Create test client with mock mode enabled."""
    import os
    os.environ["SAM2_MOCK"] = "1"
    from server import app
    from fastapi.testclient import TestClient
    return TestClient(app)


class TestHealth:
    def test_health_check(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "device" in data


class TestSegment:
    def test_auto_segment_returns_subject_png(self, client):
        """Auto-segment should return a subject PNG with alpha channel."""
        b64 = make_test_image_b64()
        resp = client.post("/segment", json={"imageBase64": b64})
        assert resp.status_code == 200
        data = resp.json()
        assert "subjectBase64" in data
        assert "maskBase64" in data
        assert "boundingBox" in data

        # Decode subject and verify it has alpha channel
        subject_bytes = base64.b64decode(data["subjectBase64"])
        subject_img = Image.open(io.BytesIO(subject_bytes))
        assert subject_img.mode == "RGBA", f"Expected RGBA, got {subject_img.mode}"

    def test_auto_segment_bounding_box(self, client):
        """Bounding box should be a dict with x, y, w, h."""
        b64 = make_test_image_b64()
        resp = client.post("/segment", json={"imageBase64": b64})
        data = resp.json()
        bb = data["boundingBox"]
        assert "x" in bb and "y" in bb and "w" in bb and "h" in bb
        assert all(isinstance(v, (int, float)) for v in bb.values())

    def test_segment_rejects_empty_input(self, client):
        resp = client.post("/segment", json={})
        assert resp.status_code == 422 or resp.status_code == 400


class TestSegmentInteractive:
    def test_point_prompted_segment(self, client):
        """Interactive segment with point prompts."""
        b64 = make_test_image_b64()
        resp = client.post("/segment/interactive", json={
            "imageBase64": b64,
            "points": [{"x": 100, "y": 100, "label": 1}],
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "subjectBase64" in data
        assert "maskBase64" in data

    def test_box_prompted_segment(self, client):
        """Interactive segment with bounding box prompt."""
        b64 = make_test_image_b64()
        resp = client.post("/segment/interactive", json={
            "imageBase64": b64,
            "box": [50, 50, 150, 150],
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "subjectBase64" in data


class TestContour:
    def test_contour_returns_outline_png(self, client):
        """Contour endpoint should return a PNG with outlines."""
        b64 = make_test_image_b64()
        # First segment to get a mask
        seg_resp = client.post("/segment", json={"imageBase64": b64})
        mask_b64 = seg_resp.json()["maskBase64"]

        resp = client.post("/contour", json={
            "maskBase64": mask_b64,
            "color": "#FFFFFF",
            "width": 3,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "contourBase64" in data

        # Decode and verify it's an RGBA image
        contour_bytes = base64.b64decode(data["contourBase64"])
        contour_img = Image.open(io.BytesIO(contour_bytes))
        assert contour_img.mode == "RGBA"


class TestComposite:
    def test_composite_subjects_onto_background(self, client):
        """Composite multiple layers onto a background."""
        bg = make_test_image_b64(400, 400)

        # Make a "subject" with alpha
        subject_img = Image.new("RGBA", (100, 100), (255, 0, 0, 200))
        buf = io.BytesIO()
        subject_img.save(buf, format="PNG")
        subject_b64 = base64.b64encode(buf.getvalue()).decode()

        resp = client.post("/composite", json={
            "backgroundBase64": bg,
            "width": 400,
            "height": 400,
            "layers": [
                {
                    "imageBase64": subject_b64,
                    "x": 50,
                    "y": 50,
                    "width": 100,
                    "height": 100,
                    "opacity": 1.0,
                },
                {
                    "imageBase64": subject_b64,
                    "x": 200,
                    "y": 200,
                    "width": 80,
                    "height": 80,
                    "opacity": 0.7,
                },
            ],
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "resultBase64" in data

        # Verify output dimensions
        result_bytes = base64.b64decode(data["resultBase64"])
        result_img = Image.open(io.BytesIO(result_bytes))
        assert result_img.size == (400, 400)

    def test_composite_with_drop_shadow(self, client):
        """Composite with drop shadow effect."""
        bg = make_test_image_b64(400, 400)
        subject_img = Image.new("RGBA", (100, 100), (255, 0, 0, 255))
        buf = io.BytesIO()
        subject_img.save(buf, format="PNG")
        subject_b64 = base64.b64encode(buf.getvalue()).decode()

        resp = client.post("/composite", json={
            "backgroundBase64": bg,
            "width": 400,
            "height": 400,
            "layers": [
                {
                    "imageBase64": subject_b64,
                    "x": 100,
                    "y": 100,
                    "width": 100,
                    "height": 100,
                    "dropShadow": {"blur": 10, "offsetX": 5, "offsetY": 5, "color": "black"},
                },
            ],
        })
        assert resp.status_code == 200
        assert "resultBase64" in resp.json()
