<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Barryvdh\DomPDF\Facade\Pdf;

class AiPdfController extends Controller
{
    public function exportProductReport(Request $request)
    {
        try {
            $data = $request->validate([
                'product' => 'required|array',
                'analysis' => 'required|array',
                'chartBase64' => 'nullable|string'
            ]);

            $pdf = Pdf::loadView('pdf.ai_product_report', [
                'product' => $data['product'],
                'analysis' => $data['analysis'],
                'chart' => $data['chartBase64'] ?? null,
                'generatedAt' => now()->format('d/m/Y H:i')
            ])->setPaper('a4', 'portrait');

            return $pdf->download('Reporte_IA_' . str_replace(' ', '_', $data['product']['title']) . '.pdf');

        } catch (\Throwable $th) {
            return response()->json([
                'success' => false,
                'message' => 'Error generando PDF: ' . $th->getMessage()
            ], 500);
        }
    }
}
