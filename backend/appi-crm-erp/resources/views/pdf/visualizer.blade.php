<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $report['title'] ?? 'Reporte IA' }}</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.1/css/all.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js"></script>
    <style>
        body { background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); padding: 20px; font-family: 'Segoe UI', sans-serif; }
        .card-report { box-shadow: 0 20px 40px rgba(0,0,0,0.15); border-radius: 20px; overflow: hidden; }
        canvas { background: white; border-radius: 15px; padding: 20px; box-shadow: 0 8px 25px rgba(0,0,0,0.1); }
        .chart-container { position: relative; height: 550px; }
    </style>
</head>
<body>
<div class="container-fluid">
    <div class="row justify-content-center">
        <div class="col-lg-11">
            <div class="card card-report border-0 mt-5">
                <div class="card-header text-white text-center py-5" style="background: linear-gradient(120deg, #667eea 0%, #764ba2 100%);">
                    <h2 class="mb-0"><i class="fas fa-brain me-3"></i>{{ $report['title'] }}</h2>
                    <small class="opacity-90">Generado el {{ $report['generated_at'] ?? now()->format('d/m/Y H:i') }}</small>
                </div>
                <div class="card-body p-5">

                    @if(isset($report['analysis']))
                        <div class="alert alert-info border-0 shadow-sm rounded-4 p-4 mb-5">
                            <strong class="text-primary"><i class="fas fa-lightbulb me-2"></i>Análisis Inteligente:</strong><br>
                            {!! nl2br(e($report['analysis'])) !!}
                        </div>
                    @endif

                    @if(isset($report['chart_type']))
                        <div class="chart-container mb-5">
                            <canvas id="smartChart"></canvas>
                        </div>
                    @endif

                    @if(isset($report['table']) && !empty($report['table']))
                        <h4 class="mt-5 text-primary"><i class="fas fa-table me-2"></i>Datos Detallados</h4>
                        <div class="table-responsive rounded-4 shadow-sm">
                            <table class="table table-hover align-middle">
                                <thead class="table-primary">
                                    <tr>
                                        @foreach(array_keys((array)$report['table'][0]) as $header)
                                            <th>{{ ucwords(str_replace('_', ' ', $header)) }}</th>
                                        @endforeach
                                    </tr>
                                </thead>
                                <tbody>
                                    @foreach($report['table'] as $row)
                                        <tr>
                                            @foreach((array)$row as $cell)
                                                <td>{{ $cell }}</td>
                                            @endforeach
                                        </tr>
                                    @endforeach
                                </tbody>
                            </table>
                        </div>
                    @endif

                </div>
                <div class="card-footer text-center bg-light">
                    <small class="text-muted">Asistente de Inventarios IA • Reporte interactivo y temporal</small>
                </div>
            </div>
        </div>
    </div>
</div>

@if(isset($report['chart_type']))
<script>
// COLORES ALEATORIOS HERMOSOS
const generateColors = (num) => {
    const colors = [];
    const baseColors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#DDA0DD',
        '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8C471', '#82E0AA'
    ];
    for (let i = 0; i < num; i++) {
        const color = baseColors[i % baseColors.length];
        colors.push(color + 'CC'); // con transparencia
    }
    return colors;
};

document.addEventListener('DOMContentLoaded', function () {
    const ctx = document.getElementById('smartChart').getContext('2d');
    const rawData = @json($report['table']);
    
    // Detectar automáticamente la columna de etiquetas y valores
    const keys = Object.keys(rawData[0] || {});
    let labelKey = keys.find(k => k.toLowerCase().includes('producto') || k.toLowerCase().includes('mes') || k.toLowerCase().includes('categoria') || k.toLowerCase().includes('area')) || keys[0];
    let valueKey = keys.find(k => k.toLowerCase().includes('total') || k.toLowerCase().includes('cantidad') || k.toLowerCase().includes('stock') || k.toLowerCase().includes('salida') || k.toLowerCase().includes('entrada') || k.toLowerCase().includes('consumo')) || keys[1];

    const labels = rawData.map(row => String(row[labelKey] || 'Sin dato').substring(0, 40));
    const values = rawData.map(row => parseFloat(row[valueKey]) || 0);

    const chartType = "{{ $report['chart_type'] }}";
    const isHorizontal = "{{ $report['orientation'] ?? '' }}" === "horizontal";

    new Chart(ctx, {
        type: isHorizontal ? 'bar' : chartType,
        data: {
            labels: labels,
            datasets: [{
                label: "{{ $report['chart_label'] ?? 'Valor' }}",
                data: values,
                backgroundColor: generateColors(values.length),
                borderColor: generateColors(values.length).map(c => c.replace('CC', '')),
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: true, position: 'top', labels: { font: { size: 14 } } },
                title: { display: true, text: "{{ $report['title'] }}", font: { size: 20, weight: 'bold' }, color: '#333' },
                tooltip: { 
                    enabled: true,
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleFont: { size: 16 }, 
                    bodyFont: { size: 14 },
                    callbacks: {
                        label: function(context) {
                            return ` ${context.dataset.label}: ${context.parsed.y.toLocaleString()} unidades`;
                        }
                    }
                }
            },
            indexAxis: isHorizontal ? 'y' : 'x',
            scales: {
                x: { 
                    ticks: { 
                        maxRotation: 45, 
                        minRotation: 45,
                        font: { size: 11 },
                        callback: function(value) {
                            const label = this.getLabelForValue(value);
                            return label.length > 20 ? label.substr(0, 20) + '...' : label;
                        }
                    },
                    grid: { display: false }
                },
                y: { 
                    beginAtZero: true,
                    ticks: { font: { size: 12 } },
                    grid: { color: 'rgba(0,0,0,0.05)' }
                }
            },
            animation: { duration: 1500, easing: 'easeOutQuart' }
        },
        plugins: [ChartDataLabels]
    });
});
</script>
@endif
</body>
</html>