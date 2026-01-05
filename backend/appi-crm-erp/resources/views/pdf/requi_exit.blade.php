<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Borrador Vale - REQ_EXIT_{{ $exit->folio }}</title>
    <title>Vale de Salida - {{ $exit->requisition }}</title>
    <style>
        @page {
            margin: 1cm; /* Añadimos margen en todos los lados */
            size: A4;
        }
        body {
            font-family: Arial, sans-serif;
            font-size: 11px;
            margin: 0;
            padding: 0;
        }
        .container {
            width: 100%;
            max-width: 19cm; /* Ajustado para considerar los márgenes */
            box-sizing: border-box;
        }
        .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 10px;
        }
        .header-table td {
            vertical-align: middle;
            padding: 0;
        }
        .header-table .logo {
            width: 15%;
            text-align: left;
        }
        .header-table img {
            width: 3.5cm;
            height: 3cm;
        }
        .header-table .titles {
            width: 85%;
            text-align: center;
        }
        .header-table .main-title {
            font-size: 13px;
            font-weight: bold;
            margin: 0;
            text-transform: uppercase;
        }
        .header-table p {
            font-size: 11px;
            margin: 2px 0;
            text-transform: uppercase;
        }
        .products-title {
            font-weight: bold;
            font-size: 13px;
            text-transform: uppercase;
            text-align: center;
            margin: 5px 0;
        }
        .info-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 10px;
        }
        .info-table td {
            border: 1px solid #000;
            padding: 5px;
            font-size: 11px;
        }
        .info-table .label {
            font-weight: bold;
            width: 20%;
        }
        .products-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 10px;
        }
        .products-table th, .products-table td {
            border: 1px solid #000;
            padding: 6px;
            text-align: center;
            font-size: 11px;
            vertical-align: middle;
        }
        .products-table th {
            background-color: #e6e6e6;
            font-weight: bold;
        }
        .products-table th.factura, .products-table td.factura {
            width: 120px; /* Aumentado para facturas largas */
            word-wrap: break-word;
            white-space: normal;
        }
        .signature-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        .signature-table td {
            width: 33.33%;
            border: 1px solid #000;
            padding: 10px;
            text-align: center;
            font-size: 11px;
            height: 80px; /* Reducido para optimizar espacio */
            vertical-align: top; /* Alineación en la parte superior */
        }
        /* Modificado: Eliminamos posicionamiento absoluto para firmas */
        .signature-title {
            font-weight: bold;
            margin-bottom: 50px; /* Espacio para firmas */
        }
        .signature-name {
            margin: 0;
        }
        .signature-position {
            margin: 0;
            font-size: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Encabezado -->
        <table class="header-table">
            <tr>
                <td class="logo">
                    @if(file_exists(public_path('/logfis.png')))
                        <img src="{{ public_path('logfis.png') }}" alt="Logo">
                    @else
                        <p>[Logo]</p>
                    @endif
                </td>
                <td class="titles">
                    <p class="main-title">FISCALÍA GENERAL DEL ESTADO DE NAYARIT</p>
                    <p>DIRECCIÓN GENERAL DE ADMINISTRACIÓN</p>
                    <p>DEPARTAMENTO DE RECURSOS MATERIALES</p>
                </td>
            </tr>
        </table>
        
        <!-- Información general -->
        <p class="products-title">VALE DE SALIDA ALMACÉN DE RECURSOS MATERIALES</p>
        <table class="info-table">
            <tr>
                <td class="label">Folio:</td>
                <td>{{ $exit->folio }}</td>
            </tr>
            <tr>
                <td class="label">Área:</td>
                <td>{{ $exit->area->name ?? 'N/A' }}</td>
            </tr>
            <tr>
                <td class="label">Subárea:</td>
                <td>{{ $exit->subarea->name ?? 'N/A' }}</td>
            </tr>
            <tr>
                <td class="label">Referencia:</td>
                <td>{{ $requisition->call?->title ?? 'N/A' }}</td>
            </tr>
            <tr>
                <td class="label">Fecha de salida:</td>
                <td>{{ \Carbon\Carbon::parse($exit->exit_date)->format('d-m-Y') }}</td>
            </tr>
            @if($exit->pending_expires_at)
            <tr>
                <td class="label">Expira el:</td>
                <td>{{ \Carbon\Carbon::parse($exit->pending_expires_at)->format('d-m-Y H:i') }}</td>
            </tr>
            @endif
        </table>

        <!-- Productos -->
        <p class="products-title">PRODUCTO(S)</p>
        <table class="products-table">
            <thead>
                <tr>
                    <th style="width: 5%;">No.</th>
                    <th style="width: 55%;">Producto</th>
                    <th style="width: 10%;">Cantidad</th>
                    <th class="factura">Factura</th>
                </tr>
            </thead>
            <tbody>
            @forelse($productList as $index => $product)
                <tr>
                    <td>{{ $index + 1 }}</td>
                    <td>{{ $product['product_title'] }} ({{ $product['unit'] }})</td>
                    <td>{{ $product['quantity'] }}</td>
                    <td class="factura">{{ $product['invoice'] }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="4">No hay productos</td>
                </tr>
            @endforelse
            </tbody>
        </table>

        <!-- Firmas -->
        <table class="signature-table">
            <tr>
                <td>
                    <p class="signature-title">RECIBIÓ MERCANCÍA</p>
                </td>
                <td>
                    <p class="signature-title">SELLO, NOMBRE Y FIRMA</p>
                </td>
                <td>
                    <p class="signature-title">AUTORIZÓ</p>
                    @if($jefeMateriales)
                        <p class="signature-name fw-bold">
                            {{ $jefeMateriales->title ? $jefeMateriales->title . '. ' : '' }}{{ $jefeMateriales->name }}
                        </p>
                        <p class="signature-position text-muted small">
                            {{ $jefeMateriales->position }}
                        </p>
                        <p class="signature-position text-muted small">
                            {{ $jefeMateriales->departament }}
                        </p>
                    @else
                        <p class="text-danger small">¡Configurar firmante!</p>
                    @endif
                </td>
            </tr>
        </table>
    </div>
</body>
</html>