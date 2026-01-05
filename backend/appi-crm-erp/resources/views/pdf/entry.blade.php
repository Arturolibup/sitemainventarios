<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Constancia de Recepción en Almacén</title>
    <style>
        body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
        .container { width: 100%; max-width: 800px; margin: 0 auto; }

        /* Tabla para el encabezado en un solo renglón */
        .header-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .header-table td { vertical-align: middle; padding: 0; }
        .header-table .logo { width: 15%; text-align: left; }
        .header-table .titles { width: 85%; text-align: center; }
        .header-table img { width: 3.5cm; height: 3cm; }
        .header-table .main-title { font-size: 14px; font-weight: bold; margin: 0; text-transform: uppercase; }
        .header-table p { font-size: 11px; margin: 2px 0; text-transform: uppercase; }

        /* Título de la tabla de productos */
        .products-title { font-weight: bold; font-size: 14px; text-transform: uppercase; text-align: center; margin-bottom: 5px; }

        /* Tabla de información general */
        .info-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
        .info-table td { border: 1px solid #000; padding: 5px; font-size: 11px; }
        .info-table .label { font-weight: bold; width: 20%; }

        /* Tabla de productos */
        .products-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        .products-table th, .products-table td { border: 1px solid #000; padding: 6px; text-align: center; font-size: 11px; }
        .products-table th { background-color: #e6e6e6; font-weight: bold; }

        /* Totales en tabla alineada a la derecha */
        .totals-table { width: 40%; margin-left: auto; margin-bottom: 15px; border-collapse: collapse; }
        .totals-table td { padding: 2px 5px; font-size: 11px; text-align: right; }
        .totals-table .label { font-weight: bold; width: 50%; text-align: right; }
        .totals-table .value { width: 50%; }

        /* Cantidad en letras */
        .amount-in-words { font-style: italic; font-size: 11px; margin-bottom: 15px; }

        /* Imágenes */
        .images-section { margin-bottom: 10px; }
        .images-section img { max-width: 90px; max-height: 90px; margin: 5px; border: 1px solid #ccc; }

        /* Firmas en tabla de 3 columnas con más espacio */
        .signature-table { width: 100%; border-collapse: collapse; margin-top: 40px; }
        .signature-table td { width: 33.33%; border: 1px solid #000; padding: 10px; text-align: center; font-size: 11px; height: 110px; }
        .signature-line { border-top: 1px solid #000; margin: 60px 0 10px 0; }
        .signature-label { font-weight: bold; margin: 0; }
    </style>
</head>
<body>
    <div class="container">
        <!-- Encabezado en un solo renglón -->
        <table class="header-table">
            <tr>
                <td class="logo">
                    <img src="{{ public_path('logfis.png') }}" alt="Logo Fiscalía General">
                </td>
                <td class="titles">
                    <p class="main-title">FISCALÍA GENERAL DEL ESTADO DE NAYARIT</p>
                    <p>DIRECCIÓN GENERAL DE ADMINISTRACIÓN</p>
                    <p>DEPARTAMENTO DE RECURSOS MATERIALES</p>
                </td>
            </tr>
        </table>

        <!-- Título de la tabla de productos -->
        <p class="products-title">CONSTANCIA DE RECEPCIÓN EN ALMACÉN</p>

        <!-- Información general -->
        <table class="info-table">
            <tr>
                <td class="label">No. Factura:</td>
                <td>{{ $entry->invoice_number }}</td>
                <td class="label">Proveedor:</td>
                <td>{{ $entry->provider->full_name ?? 'N/A' }}</td>
            </tr>
            <tr>
                <td class="label">Origen del Recurso:</td>
                <td>{{ $entry->resource_origin ?? 'N/A' }}</td>
                <td class="label">Orden de pedido:</td>
                <td>{{ $entry->order_number }}</td>
            </tr>
            <tr>
                <td class="label">Fecha:</td>
                <td>{{ \Carbon\Carbon::parse($entry->entry_date)->format('d-m-Y') }}</td>
                <td class="label">Proceso:</td>
                <td>{{ $entry->process }}</td>
            </tr>
            <tr>
                <td class="label">Elaboró:</td>
                <td colspan="3">{{ $createdByName ?? 'N/A' }}</td>
            </tr>
        </table>

        <!-- Tabla de productos -->
        <p><strong>ARTÍCULO(S)</strong></p>
        <table class="products-table">
            <thead>
                <tr>
                    <th>CANT.</th>
                    <th>U.M.</th>
                    <th>DESCRIPCIÓN</th>
                    <th>PARTIDA</th>
                    <th>P.U.</th>
                    <th>IMPORTE</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($entry->products as $product)
                    <tr>
                        <td>{{ $product->quantity }}</td>
                        <td>Pieza</td>
                        <td>{{ $product->product->title ?? 'N/A' }}</td>
                        <td>{{ $product->partida ?? 'N/A' }}</td>
                        <td>${{ number_format($product->unit_price, 2, '.', ',') }}</td>
                        <td>${{ number_format($product->quantity * $product->unit_price, 2, '.', ',') }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>

        <!-- Totales en tabla alineada a la derecha -->
        <table class="totals-table">
            <tr>
                <td class="label">Subtotal:</td>
                <td class="value">${{ number_format($entry->subtotal, 2, '.', ',') }}</td>
            </tr>
            <tr>
                <td class="label">I.V.A.:</td>
                <td class="value">${{ number_format($entry->iva, 2, '.', ',') }}</td>
            </tr>
            <tr>
                <td class="label">Total:</td>
                <td class="value">${{ number_format($entry->total, 2, '.', ',') }}</td>
            </tr>
        </table>
        <div class="clear"></div>

        <!-- Cantidad en letras -->
        <div class="amount-in-words">
            <p><strong>Cantidad en letra:</strong> {{ $amountInWords }}</p>
        </div>

        <!-- Imágenes -->
        <div class="images-section">
            <p><strong>Imágenes:</strong></p>
            @if (count($officialImages) > 0)
                @foreach ($officialImages as $image)
                    <img src="{{ $image['path'] }}" alt="{{ $image['original_name'] }}">
                @endforeach
            @else
                <p>No hay imágenes asociadas.</p>
            @endif
        </div>

        <!-- Firmas en tabla de 3 columnas con más espacio -->
        <table class="signature-table">
            <tr>
                <td>
                    <div class="signature-line"></div>
                    <p class="signature-label">RECIBIÓ</p>
                </td>
                <td>
                    <div class="signature-line"></div>
                    <p class="signature-label">SELLO</p>
                </td>
                <td>
                    <div class="signature-line"></div>
                    <p class="signature-label">NOMBRE Y FIRMA</p>
                </td>
            </tr>
        </table>
    </div>
</body>
</html>