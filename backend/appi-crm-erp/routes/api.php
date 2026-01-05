<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ChatController;

use App\Http\Controllers\OP\TipoController;
use App\Http\Controllers\OP\MarcaController;
use App\Http\Controllers\OP\OrderController;
use App\Http\Controllers\Api\AiPdfController;

use App\Http\Controllers\Api\AiChatController;
use App\Http\Controllers\OP\InvoiceController;
use App\Http\Controllers\UserAccessController;

use App\Http\Controllers\OP\VehiculoController;
use App\Http\Controllers\Api\AiGlobalController;
use App\Http\Controllers\Api\AiReportsController;
use App\Http\Controllers\RolePermissionController;
use App\Http\Controllers\Api\RequisitionController;
use App\Http\Controllers\OP\NotificationController;
use App\Http\Controllers\Product\ProductController;
use App\Http\Controllers\Api\AiAreaReportsController;
use App\Http\Controllers\Api\AiRequisitionController;
use App\Http\Controllers\Api\Chat\ChatFileController;
use App\Http\Controllers\Api\Chat\ChatUserController;
use App\Http\Controllers\Configuration\AreaController;
use App\Http\Controllers\Configuration\UnitController;
use App\Http\Controllers\Api\RequisitionCallController;
use App\Http\Controllers\Product\ProductExitController;
use App\Http\Controllers\Signatory\SignatoryController;
use App\Http\Controllers\Api\Chat\ChatMessageController;
use App\Http\Controllers\Api\VehicleDashboardController;
use App\Http\Controllers\Product\ProductEntryController;
use App\Http\Controllers\Configuration\SubareaController;
use App\Http\Controllers\Configuration\ProviderController;
use App\Http\Controllers\Api\Chat\ChatConversationController;
use App\Http\Controllers\Car\CarController;       // módulo cars
use App\Http\Controllers\Configuration\ProductCategorieController;

// --- Rutas públicas / auth ---
Route::group([
  'prefix' => 'auth',
], function () {
  Route::post('/register', [AuthController::class, 'register'])->name('register');
  Route::post('/login',    [AuthController::class, 'login'])->name('login');
  Route::post('/logout',   [AuthController::class, 'logout'])->name('logout');
  Route::post('/refresh',  [AuthController::class, 'refresh'])->name('refresh');
  Route::post('/me',       [AuthController::class, 'me'])->name('me');
});

// perfil rápido autenticado
Route::middleware('auth:api')->get('/me', function (Request $request) {
  $user = $request->user();
  return response()->json([
    'id'          => $user->id,
    'name'        => $user->name,
    'surname'     => $user->surname,
    'email'       => $user->email,
    'area_id'     => $user->area_id,
    'area_name'   => optional($user->area)->name,
    'subarea_id'  => $user->subarea_id,
    'subarea_name'=> optional($user->subarea)->name,
    'roles'       => $user->getRoleNames(),
    'permissions' => $user->getAllPermissions()->pluck('name')->values(),
  ]);
});

// ======================
// 🔐 TODO lo protegido
// ======================
Route::middleware('auth:api')->group(function () {

  // ===== Roles & Users =====
  Route::resource('roles', RolePermissionController::class)->middleware('permission:roles.list');
  

  Route::get('users/config', [UserAccessController::class, 'config'])->middleware('permission:users.view');
  Route::post('/users/{id}', [UserAccessController::class, 'update'])->middleware('permission:users.update');// subir imagen, etc.
  Route::resource('users', UserAccessController::class)->middleware('permission:users.list');

  // ===== Áreas / Subáreas =====
  Route::get('areas/municipios', [App\Http\Controllers\Configuration\AreaController::class, 'getMunicipios'])
    ->middleware('auth:api');
  Route::resource('areas', AreaController::class)
    ->middleware('permission:areas.list');

  Route::get('subareas/municipios', [App\Http\Controllers\Configuration\AreaController::class, 'getMunicipios'])
    ->middleware('auth:api');
  Route::get('/subareas',        [SubareaController::class, 'index'])->middleware('permission:subareas.list');
  Route::post('/subareas',       [SubareaController::class, 'store'])->middleware('permission:subareas.create');
  Route::put('/subareas/{id}',   [SubareaController::class, 'update'])->middleware('permission:subareas.update');
  Route::delete('/subareas/{id}',[SubareaController::class, 'destroy'])->middleware('permission:subareas.delete');
  Route::get('/subareas/validate-unique', [SubareaController::class, 'validateUniqueness'])->middleware('permission:subareas.view');
  Route::get('subareas/search', [SubareaController::class, 'search']);
  Route::get('subareas/area/{areaId}', [SubareaController::class, 'getByArea']);

  // ===== Categorías (usamos módulo 'categories' del seeder) =====
  Route::post('/product_categories/{id}', [ProductCategorieController::class, 'update'])
    ->middleware('permission:categories.update');
  Route::resource('/product_categories', ProductCategorieController::class)
    ->middleware('permission:categories.list');
    

  // ===== Proveedores =====
  Route::post('/providers/{id}', [ProviderController::class, 'update'])->middleware('permission:providers.update');
  Route::resource('/providers', ProviderController::class)->middleware('permission:providers.list');

  // ===== Units =====
  Route::post('/units/add-transform',        [UnitController::class, 'add_transform'])->middleware('permission:units.update');
  Route::delete('/units/delete-transform/{id}', [UnitController::class, 'delete_transform'])->middleware('permission:units.update');
  Route::resource('/units', UnitController::class)->middleware('permission:units.list');

  // ===== Cars (módulo 'cars' en el seeder) =====
  Route::prefix('cars')->group(function () {
    Route::get('/validate',              [CarController::class, 'validateUniqueness'])->middleware('permission:vehicles.view');
    Route::get('/search-subareas',       [CarController::class, 'searchSubareas'])->middleware('permission:vehicles.view');
    Route::get('/search-marcas',         [CarController::class, 'searchMarcas'])->middleware('permission:vehicles.view');
    Route::get('/search-tipos',          [CarController::class, 'searchTipos'])->middleware('permission:vehicles.view');
    Route::post('/marcas',               [CarController::class, 'storeMarca'])->middleware('permission:vehicles.create');
    Route::post('/tipos',                [CarController::class, 'storeTipo'])->middleware('permission:vehicles.create');
    Route::get('/search-for-salidas',    [CarController::class, 'searchVehicleForSalidas'])->middleware('permission:vehicles.view');

    Route::get('/',                      [CarController::class, 'index'])->middleware('permission:vehicles.list');
    Route::post('/',                     [CarController::class, 'store'])->middleware('permission:vehicles.create');
    Route::get('/{id}',                  [CarController::class, 'show'])->middleware('permission:vehicles.view');
    Route::post('/{id}',                 [CarController::class, 'update'])->middleware('permission:vehicles.update');
    Route::delete('/{id}',               [CarController::class, 'destroy'])->middleware('permission:vehicles.delete');
  });

  // ===== Productos =====
  Route::prefix('products')->group(function () {
    Route::post('/quick', [ProductController::class, 'storeQuick'])->middleware('permission:products.create');
    Route::post('/',      [ProductController::class, 'store'])->middleware('permission:products.create');
    Route::get('/check',  [ProductController::class, 'check'])->middleware('permission:products.view');
    // 🔍 Búsqueda rápida de productos (para IA y salidas)
    Route::get('/search', [ProductExitController::class, 'searchProducts'])
        ->middleware('permission:product_exits.create');
  
  });
  Route::post('/products/index',          [ProductController::class, 'index'])->middleware('permission:products.list');
  Route::post('/products/{id}',           [ProductController::class, 'update'])->middleware('permission:products.update');
  Route::get('/products/config',          [ProductController::class, 'config'])->middleware('permission:products.view');
  Route::resource('products',              ProductController::class,)->middleware('permission:products.list');
  Route::get('/products-options',         [ProductController::class, 'getProductOptions'])->middleware('permission:products.view');
  Route::get('/products/check-exists',    [ProductController::class, 'checkExists'])->middleware('permission:products.view');
  
  // ===== Catálogos OP: marcas/tipos/vehículos (mapeo a brands/types/vehicles) =====
  Route::get('/marcas', [MarcaController::class, 'index'])->middleware('permission:marca.list');
  Route::get('/tipos',  [TipoController::class, 'index'])->middleware('permission:tipos.list');

  Route::get('/opvehiculos', [VehiculoController::class, 'index'])->middleware('permission:vehicles.list');

  // ===== Órdenes de Pedido (módulo 'orders' en el seeder) =====
  Route::get('/orders',                  [OrderController::class, 'index'])->middleware('permission:orders.list');// Órdenes de pedido (Orders) — protegidas por permiso
  Route::get('/orders/{id}',             [OrderController::class, 'getOrder'])->middleware('permission:orders.view');// Órdenes de pedido (Orders) — protegidas por permiso
  Route::post('/orders',                 [OrderController::class, 'store'])->middleware('permission:orders.create_sf|orders.update');
  Route::put('/orders/{id}',             [OrderController::class, 'update'])->middleware('permission:orders.update');// Actualizar orden (edición general)

  // flujo especial
  // ✅ Ruta exclusiva para creación rápida de productos
  Route::post('/orders/create_sf',       [OrderController::class, 'createSuficiencia'])->middleware('permission:orders.create_sf|orders.update');// Crear suficiencia (creación de OP etapa inicial)
  Route::post('/orders/{id}/send-to-area2', [OrderController::class, 'sendToArea2'])->middleware('permission:orders.update');// Enviar a Área 2 (cambio de estado)
  Route::post('/orders/check-unique',    [OrderController::class, 'checkUnique'])->middleware('permission:orders.create_sf|orders.update');// Verificar unicidad (usar para crear/editar)
  Route::post('/orders/{id}/add-order-number', [OrderController::class, 'addOrderNumber'])->middleware('permission:orders.add_order_number'); //  esta es nueva, Área 1 asigna número de orden
  Route::post('/orders/{id}/validate',        [OrderController::class, 'validateOrder'])->middleware('permission:orders.validate');// Validar orden (Área 1)
  Route::put('/orders/{id}/receive',          [OrderController::class, 'receiveProducts'])->middleware('permission:orders.receive');//recepcion en almacen(area3)
  Route::delete('/orders/{id}', [OrderController::class, 'delete']);

  Route::post('/orders/{id}/validate-sf',[OrderController::class, 'validateSuficiencia']); // Validar suficiencia (Área 2)
  Route::post('/orders/{id}/assign-partidas', [OrderController::class, 'assignPartidas']); // Asignar partidas (Área 2)
  Route::post('/orders/{id}', [OrderController::class, 'update'])->middleware('permission:orders.update'); // Actualizar y generar nuevo pdf
  Route::post('/orders/{id}/send-to-area2', [OrderController::class, 'sendToArea2'])->middleware('permission:orders.create_sf');
  // PDFs / correo
  // PDF (generar/obtener/enviar)
Route::post('/orders/{id}/save-pdf',              [OrderController::class, 'saveOrderPdf'])->middleware('permission:orders.view');
Route::post('/orders/{id}/save-suficiencia-pdf',  [OrderController::class, 'saveSuficienciaPdf'])->middleware('permission:orders.view');
Route::post('/orders/{id}/send-pdf',              [OrderController::class, 'sendPdfToProvider'])->middleware('permission:orders.view');
Route::get('/orders/{id}/pdf',                    [OrderController::class, 'getPdf'])->middleware('permission:orders.view');

// Verificar PDFs en storage (si lo sigues usando)
Route::get('/storage/public/orders/',             [OrderController::class, 'verificarpdfs'])->middleware('permission:orders.list');

  // ===== Notificaciones =====
  Route::post('/notifications',              [NotificationController::class, 'store'])->name('notifications.store')->middleware('permission:orders.view');
  Route::get('/notifications',               [NotificationController::class, 'index'])->name('notifications.index')->middleware('permission:orders.view');
  Route::put('/notifications/{id}/dismiss',  [NotificationController::class, 'dismiss'])->name('notifications.dismiss')->middleware('permission:orders.view');
  Route::patch('/notifications/{id}/read',   [NotificationController::class, 'markAsRead'])->name('notifications.read')->middleware('permission:orders.view');

  Route::prefix('invoices')->group(function () {
    Route::get('/', [InvoiceController::class, 'index']);
    Route::post('/', [InvoiceController::class, 'store']);
    Route::get('/{id}', [InvoiceController::class, 'show']);
    Route::post('/{id}', [InvoiceController::class, 'update']); // o put/patch si prefieres
    Route::delete('/{id}', [InvoiceController::class, 'destroy']);
    Route::post('/{id}/photos', [InvoiceController::class, 'appendPhotos']);      // Agregar fotos
    Route::delete('/{id}/photos', [InvoiceController::class, 'deletePhoto']);     // Eliminar UNA foto (por path)
    Route::post('/{id}/replace-file', [InvoiceController::class, 'replaceFile']); // Reemplazar documento
    Route::delete('/{id}/file', [InvoiceController::class, 'deleteFile']);        // Borrar solo el documento
});
  
  
  // ===== Entradas/Salidas/Facturas (por ahora solo auth:api; si quieres permisos, añadimos módulos al seeder) =====

  // Entradas
  Route::get('/product_entries/create',                 [ProductEntryController::class, 'create'])->middleware('permission:product_entries.create');
  Route::get('/product_entries/search-providers',       [ProductEntryController::class, 'searchProviders'])->middleware('permission:product_entries.create');
  Route::get('/product_entries/search-products',        [ProductEntryController::class, 'searchProducts']);
  Route::post('/product_entries/general',               [ProductEntryController::class, 'storeGeneral']);
  Route::get('/product_entries/search-invoices',        [ProductEntryController::class, 'searchInvoices'])->middleware('permission:product_entries.create');
  Route::get('/product_entries/search-orders',          [ProductEntryController::class, 'searchOrders'])->middleware('permission:product_entries.create');
  Route::post('/product_entries/{entryId}/products',    [ProductEntryController::class, 'storeProducts'])->middleware('permission:product_entries.create');
  Route::post('/product_entries/{entryId}/evidences',   [ProductEntryController::class, 'updateEvidences'])->middleware('permission:product_entries.update');
  Route::post('/product_entries',                       [ProductEntryController::class, 'index'])->middleware('permission:product_entries.create');
  Route::get('/product_entries/evidence/{id}',          [ProductEntryController::class, 'getEvidenceFile'])->name('product-entries.evidence-file');
  Route::get('/product_entries',                        [ProductEntryController::class, 'index'])->middleware('permission:product_entries.create');
  Route::delete('/product_entries/delete/{entryId}',    [ProductEntryController::class, 'deleteEntry'])->middleware('permission:product_entries.update');
  Route::delete('/product_entries/{entryId}',           [ProductEntryController::class, 'deleteEntry'])->middleware('permission:product_entries.update');
  Route::get('/product_entries/{id}',                   [ProductEntryController::class, 'show'])->middleware('permission:product_entries.view');
  Route::put('/product_entries/{id}',                   [ProductEntryController::class, 'update'])->middleware('permission:product_entries.update');
  Route::put('/product_entries/{entryId}/products',     [ProductEntryController::class, 'updateProducts'])->middleware('permission:product_entries.update');
  Route::delete('/product_entries/evidence/{id}',       [ProductEntryController::class, 'deleteEvidence'])->middleware('permission:product_entries.delete');
  
  Route::prefix('product_entries')->group(function () {
    Route::get('search-invoices',                       [ProductEntryController::class, 'searchInvoices'])->middleware('permission:product_entries.create');
    Route::post('{entryId}/purchase-documents',         [ProductEntryController::class, 'savePurchaseDocuments'])->middleware('permission:product_entries.update');
    Route::get('{entryId}/purchase-documents',          [ProductEntryController::class, 'listPurchaseDocuments'])->middleware('permission:product_entries.view');
    Route::get('purchase-document/{id}',                [ProductEntryController::class, 'getPurchaseDocumentFile'])->middleware('permission:product_entries.view');
    Route::delete('purchase-document/{id}',             [ProductEntryController::class, 'deletePurchaseDocument'])->middleware('permission:product_entries.delete');
    Route::post('purchase-document/{id}',               [ProductEntryController::class, 'updatePurchaseDocument'])->middleware('permission:product_entries.update');
    Route::get('/product_entries/{entryId}/purchase-documents', [ProductEntryController::class, 'getPurchaseDocuments'])->middleware('permission:product_entries.view');
    Route::get('purchase-document-details/{id}',        [ProductEntryController::class, 'getPurchaseDocument'])->middleware('permission:product_entries.view');
    Route::get('/{entryId}/pdf',                        [ProductEntryController::class, 'generateEntryPdf'])->middleware('permission:product_entries.view');
  });

  // ===== Salidas
Route::prefix('product-exits')->group(function () {
  Route::get('/',                           [ProductExitController::class, 'index'])->middleware('permission:product_exits.list');
  Route::get('/create',                     [ProductExitController::class, 'create'])->middleware('permission:product_exits.create');
  Route::post('/',                          [ProductExitController::class, 'store'])->middleware('permission:product_exits.create');

  Route::get('/search-products',            [ProductExitController::class, 'searchProducts'])->middleware('permission:product_exits.create');
  Route::get('/search-areas',               [ProductExitController::class, 'searchAreas'])->middleware('permission:product_exits.create');
  Route::get('/search-subareas',            [ProductExitController::class, 'searchSubareas'])->middleware('permission:product_exits.create');
  Route::get('/{id}/pdf',                   [ProductExitController::class, 'downloadExitPdf'])->middleware('permission:product_exits.view');
  Route::get('/search-invoices',            [ProductExitController::class, 'searchInvoices'])->middleware('permission:product_exits.create');
  Route::get('/search-products-by-invoice', [ProductExitController::class, 'searchProductsByInvoice'])->middleware('permission:product_exits.create');
  Route::get('/product-entries/{productId}',[ProductExitController::class, 'getProductEntries'])->middleware('permission:product_exits.create');
  Route::post('product-exits/from-requisition/{requisition_id}', [ProductExitController::class, 'fromRequisition']);
     
  Route::get('/{id}',                       [ProductExitController::class, 'show'])->middleware('permission:product_exits.view');
  Route::put('/{id}',                       [ProductExitController::class, 'update'])->middleware('permission:product_exits.update');
  Route::delete('/{id}',                    [ProductExitController::class, 'destroy'])->middleware('permission:product_exits.delete');
  Route::post('/check-low-stock',           [ProductExitController::class, 'checkLowStock'])->middleware('permission:product_exits.create');
  Route::post('/check-low-stockalto',           [ProductExitController::class, 'checkLowStockalto']);
  Route::post('/store-general',             [ProductExitController::class, 'storeGeneral'])->middleware('permission:product_exits.create');
  Route::post('/store-products',            [ProductExitController::class, 'storeProducts'])->middleware('permission:product_exits.create');
  Route::post('/{id}/complete',             [ProductExitController::class, 'complete'])->middleware('permission:product_exits.update');
});


  // Facturas OP
  Route::prefix('invoices')->group(function () {
    Route::get('/',       [InvoiceController::class, 'index'])->middleware('permission:invoices.list');
    Route::post('/',      [InvoiceController::class, 'store'])->middleware('permission:invoices.create');
    Route::get('/{id}',   [InvoiceController::class, 'show'])->middleware('permission:invoices.view');
    Route::put('/{id}',   [InvoiceController::class, 'update'])->middleware('permission:invoices.update');
    Route::delete('/{id}',[InvoiceController::class, 'destroy'])->middleware('permission:invoices.delete');
  });

// 🔹 Convocatorias (Área 3)
Route::prefix('requisition-calls')->group(function () {
    Route::get('/', [RequisitionCallController::class, 'index']);                  // Listar convocatorias
    Route::post('/', [RequisitionCallController::class, 'store']);                 // Crear convocatoria
    Route::get('/active', [RequisitionCallController::class, 'active']);           // Obtener convocatoria activa
    Route::get('/search-products', [RequisitionCallController::class, 'searchProducts']); // Buscar productos disponibles
    Route::get('/{id}', [RequisitionCallController::class, 'show']);               // Ver detalles (con productos)
    Route::put('/{id}', [RequisitionCallController::class, 'update']);             // Actualizar info básica
    Route::post('/{id}/sync-products', [RequisitionCallController::class, 'syncProducts']); // Actualizar productos de convocatoria
    Route::patch('requisition-calls/{id}/toggle-active', [RequisitionCallController::class, 'toggleActive']);
    Route::delete('/{id}', [RequisitionCallController::class, 'destroy']);          // Eliminar convocatoria

  });

// 🔹 Requisiciones (por área)
Route::prefix('requisitions')->group(function () {
    Route::get('/', [RequisitionController::class, 'index']);                      // Listar requisiciones (Área 3)
    Route::get('/my', [RequisitionController::class, 'myRequisitions']);           // Requisiciones del usuario logueado
    Route::post('/', [RequisitionController::class, 'store']);                     // Crear requisición (por área)
    Route::put('/{id}/save-draft', [RequisitionController::class, 'saveDraft']);   // Guardar borrador
    
    Route::post('/{id}/send', [RequisitionController::class, 'send']);             // Enviar requisición a validación
    Route::post('/{id}/approve', [RequisitionController::class, 'approve']);       // Aprobar (Área 3)
    Route::get('/{id}', [RequisitionController::class, 'show']);                   // Ver detalles (productos + estatus)
    Route::post('/requisitions/generate-base', [RequisitionController::class, 'generateFromCall']);// EXISTENTE (Almacén)
    Route::post('/generate-from-base', [RequisitionController::class, 'generateFromBase']);// NUEVA (Áreas)
    Route::post('/generate-from-call', [RequisitionController::class, 'generateFromCall']);
    
    // Generar salida desde requisición aprobada
      // 1. IMPRIMIR BORRADOR (descarga directa)
    Route::get('{id}/print-draft', [RequisitionController::class, 'printRequisitionDraft'])
    ->name('requisitions.print-draft');
    // 2. SUBIR VALE FIRMADO
    Route::post('{id}/exit-pdf', [RequisitionController::class, 'uploadRequisitionExitPdf'])
        ->name('requisitions.upload-exit-pdf');

    // 3. OBTENER URL DEL VALE FIRMADO (API JSON)
    Route::get('{id}/exit-pdf', [RequisitionController::class, 'getRequisitionExitPdf'])
        ->name('requisitions.get-exit-pdf');
  });

      // routes/api.php
    Route::get('requisitions/{id}/print-draft-pdf', [RequisitionController::class, 'getPrintDraftPdf'])
    ->name('requisitions.print-draft-pdf');
  

 });

 
  Route::prefix('ai')->group(function () {
    Route::post('/analysis/global', [AiGlobalController::class, 'analyze']);
    Route::post('/analysis/requisitions/{id}', [AiRequisitionController::class, 'analyze']);
    Route::post('/reports/latest', [AiReportsController::class, 'latest']);
    Route::get('/reports/areas/{areaId}', [AiAreaReportsController::class, 'show']);
    Route::post('/chat', [AiChatController::class, 'chat']);
    Route::post('/analysis/insights', [AiGlobalController::class, 'insights']);
    //Route::post('/reports/pdf', [AiPdfController::class, 'exportProductReport']);
    Route::post('/analysis/product', [AiReportsController::class, 'analyzeProduct']);
    Route::post('/requisitions/{id}/analyze', [AiRequisitionController::class, 'analyze']);
  });

    Route::get('ai-area-reports/{areaId}', [AiAreaReportsController::class, 'show']);

    // Nueva ruta para el dashboard de la pestaña 4
    Route::get('ai-area-reports-dashboard', [AiAreaReportsController::class, 'dashboard']);
      
    Route::prefix('reports')->group(function () {
    Route::post('/pdf', [AiReportsController::class, 'exportPdf']);
    
    
});


Route::prefix('reports/vehicle-dashboard')->group(function () {

    // Filtros dinámicos
    Route::get('/filters', [VehicleDashboardController::class, 'filters']);

    // KPIs + gráficas
    Route::get('/summary', [VehicleDashboardController::class, 'summary']);

    // Tablas analíticas
    Route::get('/tables', [VehicleDashboardController::class, 'tables']);

    // Detalle paginado
    Route::get('/detail', [VehicleDashboardController::class, 'detail']);

    // Insights IA
    Route::post('/aiinsights', [VehicleDashboardController::class, 'aiInsights']);

    Route::get('/export-pdf', [VehicleDashboardController::class, 'exportPdf']);

});





// BUSCADOR DE PARTIDAS REALES QUE EXISTEN EN TUS ENTRADAS
Route::get('/partidas/existentes', function(Request $request) {
    $q = $request->query('q', '');

    if (strlen($q) < 2) {
        return response()->json([]);
    }

    $partidas = DB::table('product_entries')
        ->select('partida')
        ->whereNotNull('partida')
        ->where('partida', 'LIKE', "%{$q}%")
        ->distinct()
        ->orderBy('partida')
        ->limit(15)
        ->pluck('partida');

    return response()->json(
        $partidas->map(fn($p) => [
            'id'   => $p,
            'name' => "Partida {$p}",
            'descripcion' => "Usada en " . DB::table('product_entries')->where('partida', $p)->count() . " entradas"
        ])
    );
});

Route::get('/ai/priority-products', function () {
    $filters = request()->all();

    // 1. OBTENER PRODUCTOS CRÍTICOS SEGÚN IA (tu lógica actual)
    $priority = AiModel::getPriorityProducts($filters); // ← TU IA

    // 2. OBTENER STOCK REAL DE product_warehouses
    $productIds = collect($priority)->pluck('product_id')->filter()->toArray();

    $stocks = DB::table('product_warehouses')
        ->whereIn('product_id', $productIds)
        ->whereNull('deleted_at')
        ->get()
        ->groupBy('product_id')
        ->map->sum('stock');

    // 3. COMBINAR IA + STOCK
    $result = collect($priority)->map(function ($p) use ($stocks) {
        $p['stock_actual'] = $stocks[$p['product_id']] ?? 0;
        $p['consumo_mensual'] = $p['monthly_trend'][count($p['monthly_trend']) - 1] ?? 0;
        return $p;
    })->values();

    return response()->json(['success' => true, 'data' => $result]);
});
 
Route::prefix('signa')->group(function () {
    // Rutas principales (coinciden con tu servicio Angular)
    Route::get('/', [SignatoryController::class, 'index']);           // GET /api/signa
    Route::post('/', [SignatoryController::class, 'store']);          // POST /api/signa
    Route::post('/{id}', [SignatoryController::class, 'update']);     // POST /api/signa/{id}
    Route::delete('/{id}', [SignatoryController::class, 'destroy']);  // DELETE /api/signa/{id}
    Route::get('/config', [SignatoryController::class, 'config']);    // GET /api/signa/config
    
    // Rutas específicas para firmantes individuales
    Route::get('/{id}', [SignatoryController::class, 'show']);        // GET /api/signa/{id}
    
    // Rutas para PDF (si las necesitas)
    Route::get('/jefe-recursos', [SignatoryController::class, 'jefeRecursos']);
    Route::get('/director', [SignatoryController::class, 'director']);
    Route::get('/firmantes-principales', [SignatoryController::class, 'firmantesPrincipales']);
    Route::post('/{id}/deactivate', [SignatoryController::class, 'deactivate']);
});

Route::middleware('auth:api')->prefix('chat')->group(function () {

    // Conversaciones
    Route::get('/conversations', [ChatConversationController::class, 'index']);
    Route::post('/conversations', [ChatConversationController::class, 'store']);
    Route::get('/conversations/{conversation}', [ChatConversationController::class, 'show']);

    // Mensajes
    Route::get('/conversations/{conversation}/messages', [ChatMessageController::class, 'index']);
    Route::post('/conversations/{conversation}/messages', [ChatMessageController::class, 'store']);
    Route::post('/conversations/{conversation}/read', [ChatMessageController::class, 'markAsRead']);

    Route::get('/users', [ChatUserController::class, 'index']);
    
    
    Route::get('/files/{file}', [ChatFileController::class, 'download'])->name('chat.files.download');
});