<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Reporte IA - {{ $product['title'] }}</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; margin: 40px; }
        h1, h2, h3 { color: #1e40af; margin-bottom: 5px; }
        .section { margin-top: 25px; }
        .small { color: #555; font-size: 13px; }
        .chart { text-align: center; margin-top: 20px; }
        .chart img { max-width: 90%; border: 1px solid #ddd; border-radius: 5px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { padding: 8px 10px; border: 1px solid #ddd; font-size: 14px; }
        th { background: #f3f4f6; text-align: left; }
    </style>
</head>
<body>
    <h1>📈 Reporte IA de Producto</h1>
    <h2>{{ $product['title'] }}</h2>

    <div class="section">
        <table>
            <tr><th>Categoría</th><td>{{ $product['categoria'] ?? $product['category'] ?? '—' }}</td></tr>
            <tr><th>Stock Actual</th><td>{{ $product['stock_actual'] ?? '—' }}</td></tr>
            <tr><th>Umbral</th><td>{{ $product['umbral'] ?? '—' }}</td></tr>
            <tr><th>Promedio Mensual</th><td>{{ $product['promedio_mensual'] ?? '—' }}</td></tr>
        </table>
    </div>

    <div class="section">
        <h3>🧠 Sugerencia IA</h3>
        <p>{{ $analysis['suggestion'] ?? '—' }}</p>

        <h3>📋 Justificación</h3>
        <p>{{ $analysis['justification'] ?? '—' }}</p>
    </div>

    @if($chartBase64)
    <div class="section chart">
        <h3>📊 Tendencia y Proyección</h3>
        <img src="{{ $chartBase64 }}" alt="Gráfico IA">
    </div>
    @endif

    <div class="section small">
        <p>Generado automáticamente por el módulo de Inteligencia Artificial del Sistema de Inventarios.</p>
        <p>Fecha: {{ now()->format('d/m/Y H:i') }}</p>
    </div>
</body>
</html>
