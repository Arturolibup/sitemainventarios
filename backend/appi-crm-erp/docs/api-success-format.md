# API Success Response Format

All successful (2xx) API responses should use the following envelope:

```json
{
  "status": "ok",
  "message": null,
  "data": null,
  "meta": null
}
```

## Examples

### 200 OK - List (paginated)

```json
{
  "status": "ok",
  "message": null,
  "data": [
    {
      "id": 1,
      "name": "Item A"
    },
    {
      "id": 2,
      "name": "Item B"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "per_page": 15,
      "total": 42,
      "total_pages": 3
    }
  }
}
```

### 200 OK - Show

```json
{
  "status": "ok",
  "message": null,
  "data": {
    "id": 1,
    "name": "Item A"
  },
  "meta": null
}
```

### 201 Created - Store

```json
{
  "status": "ok",
  "message": "Created successfully",
  "data": {
    "id": 10,
    "name": "New Item"
  },
  "meta": null
}
```

### 200 OK - Update

```json
{
  "status": "ok",
  "message": "Updated successfully",
  "data": {
    "id": 10,
    "name": "Updated Item"
  },
  "meta": null
}
```

### 204 No Content - Delete

_No response body._

### 200 OK - Delete (when body is required)

```json
{
  "status": "ok",
  "message": "Deleted successfully",
  "data": null,
  "meta": null
}
```
