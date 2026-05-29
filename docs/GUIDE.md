# SYSTEMPRO Data Integration Guide

This guide describes how to add, manage, and scale system architecture specifications within the SYSTEMPRO registry. Data can be loaded dynamically on boot, added manually through the administrative user interface, or hardcoded into the application baseline database.

---

## Method 1: Drop-In JSON Files (Dynamic Server Loading)

The application automatically scans a directory called `data/` at the root of the project. If a manifest file is found, it will dynamically fetch, validate, and inject each JSON specification into the local browser's IndexedDB storage.

### Steps to Add a New JSON Specification:
1.  **Create a JSON File**: Save a file (e.g., `sys_004_distributed_cache.json`) inside the [data/](file:///home/hash/sp/data/) directory.
2.  **Format the JSON**: Use the structure of the schema template defined in [template.json](file:///home/hash/sp/docs/template.json).
3.  **Register the File**: Add your JSON filename to the manifest file [data/manifest.json](file:///home/hash/sp/data/manifest.json):
    ```json
    [
      "sys_002_multi_region_db.json",
      "sys_003_telemetry_pipeline.json",
      "sys_004_distributed_cache.json"
    ]
    ```
4.  **Reload the Site**: Refresh the page. The app will fetch the manifest, download the files, parse them using strict schema sanitization, and save them.

> [!IMPORTANT]
> **CORS Security Constraint**: When running files locally using the `file://` scheme (e.g., double-clicking `index.html`), browsers block dynamic `fetch` requests to local files. To load external files from the `data/` folder, run a simple local web server:
> ```bash
> # Start a server in the project directory:
> python -m http.server 8000
> # Open http://localhost:8000 in your browser.
> ```

---

## Method 2: Manually via the Web UI (Admin Session)

You can write and edit entries directly within the browser interface:
1.  Click the **LOGIN_ADMIN** button in the header.
2.  Enter the secret key phrase phrase: `admin`.
3.  The status indicator will show `ADMIN` status and unlock management controls.
4.  Click **+ NEW_ENTRY** to create a blank specification form, or click **EDIT_SPEC** when viewing an existing item.
5.  Complete the fields and click **COMMIT_SPEC**. The changes are immediately written to IndexedDB.
6.  *Optional*: Use **EXPORT_DB** to download a unified JSON backup file of all database contents.

---

## Method 3: Hardcoded Codebase Baseline (Default Fallback)

If the local database is empty and a browser restriction or network failure blocks the `data/` directory fetch operations, the app falls back to loading baseline dummy data compiled directly into the application logic.

To modify the default fallback baseline specifications:
1.  Open the javascript file [app.js](file:///home/hash/sp/assets/js/app.js).
2.  Locate the `seedSystemData` function:
    ```javascript
    const seedSystemData = async () => {
        const baseline = [ ... ];
    }
    ```
3.  Add or modify elements in the `baseline` array conforming to the specification format.

---

## Data Schema & Format Constraints

The dynamic parser validates imports strictly. Malformed inputs are discarded.

| Field Name | Type | Constraint / Description |
| :--- | :--- | :--- |
| `id` | String | **Required**. Must match pattern `SYS-\d{3,4}` (e.g., `SYS-001` or `SYS-1024`). |
| `title` | String | **Required**. Clean system label name. |
| `category` | String | Must be one of: `distributed`, `storage`, `telemetry`, or `compute`. |
| `tags` | String | Comma-separated list of keyword strings (e.g. `"redis, caching, cluster"`). |
| `author` | String | Default falls back to `"ADMIN"` if left blank. |
| `context` | String | Architectural Context field (Supports Markdown formatting). |
| `topology` | String | ASCII block diagram text OR a valid Mermaid syntax configuration. |
| `tradeoffs` | String | Tradeoff analysis text (Supports Markdown formatting). |
| `observability` | String | Telemetry targets (Supports Markdown formatting). |
| `deployment` | String | Release runbooks (Supports Markdown formatting). |
| `security` | String | Vulnerability boundaries (Supports Markdown formatting). |
| `modified` | String | ISO formatted date string (`YYYY-MM-DD`). |
| `comments` | Array | Nested discussion thread. Defaults to `[]`. |

---

## Comment Thread Format Definition

Comments support recursive replies. Each comment node matches the following interface:

```json
{
  "id": "unique_id_string",
  "author": "developer_handle",
  "isAdmin": false,
  "text": "Comment content. *Markdown bold and code highlights supported!*",
  "timestamp": "2026-05-29T19:00:00.000Z",
  "replies": [
    {
      "id": "reply_id",
      "author": "replier_name",
      "isAdmin": true,
      "text": "Correct, validated.",
      "timestamp": "2026-05-29T19:05:00.000Z",
      "replies": []
    }
  ]
}
```
