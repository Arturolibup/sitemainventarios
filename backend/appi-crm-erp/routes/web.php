<?php

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Route;

Route::get('/ai/visualizer/{token}', function ($token) {
    
    $report = Cache::get("ai_report" . $token);

    if (!$report) {
        return view('pdf.expired', [
            'message' => 'Este reporte ya expiró o fue usado anteriormente.',
            'tip' => 'Genera uno nuevo desde el chat de IA.'
        ]);
    }

    // OPCIÓN 1: Dejar que viva las 4 horas (RECOMENDADO)
    // → El usuario puede abrirlo varias veces, refrescar, compartir, etc.
    // (no borres nada)

    // OPCIÓN 2: Solo si quieres que sea de un solo uso (descomenta la siguiente línea)
    // Cache::forget($cacheKey);

    return view('pdf.visualizer', compact('report'));
})->name('ai.visualizer');


/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "web" middleware group. Make something great!
|


Route::get('/', function () {
    return view('welcome');
});


Route::get('/order_created', function () {
    $order = (object)[
        'foliosf' => 'SF-00123',
        'order_number'=> 'op/625/2025',
        'date' => now(),
        'date_limited' => '12/25/25',
        'oficio_origen' => 'OF-5678',
        'provider' => (object)['full_name' => 'Proveedor Demo S.A. de C.V.'],
        'no_beneficiarios' => 15,
        'user' => (object)['name' => 'Usuario Demo'],
        'requesterArea' => (object)['name' => 'Área Demo'],
        'requesterSubarea' => (object)['name' => 'Subárea Demo'],
        // 👇 Agregar esta estructura
        'subarea' => (object)[
            'name' => 'Subárea Demo',
            'area' => (object)[
                'urs' => 'UR-101',
                'name' => 'Área Demo'
            ]
        ],
        'ur' => 'UR-101',
        'delivery_place' => 'Bodega Central',
        'subsidio_estatal' => 1,
        'ingresos_propios' => 0,
        'federal' => 0,
        'mixto' => 1,
        'process' => 'Licitación Simplificada',
        'concept_total' => 5000,
        'iva' => 800,
        'isr_retention' => 200,
        'total' => 5600,
        'importe_letra' => 'cinco mil seiscientos pesos con cero centavos',
        'general_observations' => 'Observaciones de prueba',
        'format_type' => 'REFACCIONES',
        'products' => collect([
            (object)[
                'placa' => 'ABC123',
                'marca_nombre' => 'Nissan',
                'tipo_nombre' => 'Tsuru',
                'modelo' => '2015',
                'cilindro' => '4',
                'ur' => 'UR-101',
                'grupo' => 'Materiales',
                'subgrupo' => 'Oficina',
                'progresivo' => '001',
                'oficio_origen' => 'OF-5678',
                'quantity' => 10,
                'unit_name' => 'PZA',
                'description' => 'Lápiz amarillo',
                'brand' => 'Bic',
                'unit_price' => 12.5,
                'partida' => '1234'
            ]
        ])
    ];

    return view('pdf.order_created', compact('order'));
}); */