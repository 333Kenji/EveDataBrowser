# Contract — GET /api/items

## Purpose
Serve paginated SDE type records with manifest metadata for the browser UI.

## Request
- **Method**: GET
- **Path**: `/api/items`
- **Query Parameters**:
  - `q` (string, optional): Case-insensitive search over `name` and group labels.
  - `group_id` (int, optional): Filter by CCP group.
  - `category_id` (int, optional): Filter by CCP category.
  - `page` (int, optional, default `1`): 1-indexed page number.
  - `page_size` (int, optional, default `50`, max `200`): Page size.
- **Headers**: `Accept: application/json`
- **Auth**: None (read-only).

## Successful Response (200)
### Headers
- `x-sde-manifest-version`: Latest manifest version (e.g., `v2024.05.14`).
- `x-sde-manifest-completed-at`: ISO timestamp for manifest completion.
- `cache-control`: `public, max-age=120`.

### Body
```json
{
  "items": [
    {
      "type_id": 603,
      "name": "Merlin",
      "group_id": 25,
      "category_id": 6,
      "group_name": "Frigate",
      "category_name": "Ship",
      "manifest_version": "v2024.05.14",
      "updated_at": "2025-09-21T18:07:11Z",
      "meta": {
        "mass": 1100000,
        "volume": 15000,
        "tech_level": 1
      }
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 50,
    "total_items": 12756,
    "total_pages": 256
  }
}
```

## Error Responses
- **400 Bad Request**: Invalid query params (non-integer `page`, `page_size > 200`). Include violation messages.
- **503 Service Unavailable**: Returned when no manifest available.

## Validation Rules
- Response MUST only include rows belonging to latest successful manifest.
- `manifest_version` in payload MUST match header `x-sde-manifest-version`.
- Pagination structure required even when zero results.
- Empty result set returns `items: []` with `total_items: 0`.

## Side Effects
None.
