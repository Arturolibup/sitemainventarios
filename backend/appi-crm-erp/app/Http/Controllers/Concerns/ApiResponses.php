<?php

namespace App\Http\Controllers\Concerns;

use Illuminate\Http\Response;

trait ApiResponses
{
    protected function successResponse(
        mixed $data = null,
        ?string $message = null,
        int $status = 200,
        mixed $meta = null
    ) {
        return response()->json(
            [
                'status' => 'ok',
                'message' => $message,
                'data' => $data,
                'meta' => $meta,
            ],
            $status
        );
    }

    protected function successWithPagination(
        mixed $data,
        array $pagination,
        ?string $message = null,
        int $status = 200
    ) {
        return $this->successResponse(
            $data,
            $message,
            $status,
            ['pagination' => $pagination]
        );
    }

    protected function noContentResponse(): Response
    {
        return response()->noContent();
    }
}
