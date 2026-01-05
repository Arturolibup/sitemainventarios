import { environment } from "src/environments/environment";

export const URL_SERVICIOS = environment.URL_SERVICIOS;
export const URL_BACKEND = environment.URL_BACKEND;
export const URL_FRONTEND = environment.URL_FRONTEND;


  export const SIDEBAR: any = [
  {
    name: 'Roles',
    submenu: [
      { label: 'Crear',  permission_name: 'roles.create' },
      { label: 'Editar', permission_name: 'roles.update' },
      { label: 'Eliminar', permission_name: 'roles.delete' },
      { label: 'Listar', permission_name: 'roles.list' },
    ]
  },
  {
    name: 'Usuarios',
    submenu: [
      { label: 'Crear',  permission_name: 'users.create' },
      { label: 'Editar', permission_name: 'users.update' },
      { label: 'Eliminar', permission_name: 'users.delete' },
      { label: 'Listar', permission_name: 'users.list' },
    ]
  },
  {
    name: 'Productos (catálogo)',
    submenu: [
      { label: 'Crear',  permission_name: 'products.create' },
      { label: 'Editar', permission_name: 'products.update' },
      { label: 'Eliminar', permission_name: 'products.delete' },
      { label: 'Listar', permission_name: 'products.list' },
    ]
  },
  {
    name: 'Categorías',
    submenu: [
      { label: 'Crear',  permission_name: 'categories.create' },
      { label: 'Editar', permission_name: 'categories.update' },
      { label: 'Eliminar', permission_name: 'categories.delete' },
      { label: 'Listar', permission_name: 'categories.list' },
    ]
  },
  {
    name: 'Unidades',
    submenu: [
      { label: 'Crear',  permission_name: 'units.create' },
      { label: 'Editar', permission_name: 'units.update' },
      { label: 'Eliminar', permission_name: 'units.delete' },
      { label: 'Listar', permission_name: 'units.list' },
    ]
  },
  {
    name: 'Vehículos',
    submenu: [
      { label: 'Crear',  permission_name: 'vehicles.create' },
      { label: 'Editar', permission_name: 'vehicles.update' },
      { label: 'Eliminar', permission_name: 'vehicles.delete' },
      { label: 'Listar', permission_name: 'vehicles.list' },
    ]
  },
  {
    name: 'Proveedores',
    submenu: [
      { label: 'Crear',  permission_name: 'providers.create' },
      { label: 'Editar', permission_name: 'providers.update' },
      { label: 'Eliminar', permission_name: 'providers.delete' },
      { label: 'Listar', permission_name: 'providers.list' },
    ]
  },
  {
    name: 'Áreas',
    submenu: [
      { label: 'Crear',  permission_name: 'areas.create' },
      { label: 'Editar', permission_name: 'areas.update' },
      { label: 'Eliminar', permission_name: 'areas.delete' },
      { label: 'Listar', permission_name: 'areas.list' },
    ]
  },
  {
    name: 'Subáreas',
    submenu: [
      { label: 'Crear',  permission_name: 'subareas.create' },
      { label: 'Editar', permission_name: 'subareas.update' },
      { label: 'Eliminar', permission_name: 'subareas.delete' },
      { label: 'Listar', permission_name: 'subareas.list' },
    ]
  },
  {
    name: 'Marcas',
    submenu: [
      { label: 'Crear',  permission_name: 'marca.create' },
      { label: 'Editar', permission_name: 'marca.update' },
      { label: 'Eliminar', permission_name: 'marca.delete' },
      { label: 'Listar', permission_name: 'marca.list' },
    ]
  },
  {
    name: 'Tipos',
    submenu: [
      { label: 'Crear',  permission_name: 'tipos.create' },
      { label: 'Editar', permission_name: 'tipos.update' },
      { label: 'Eliminar', permission_name: 'tipos.delete' },
      { label: 'Listar', permission_name: 'tipos.list' },
    ]
  },
  {
    name: 'Facturas',
    submenu: [
      { label: 'Crear',  permission_name: 'invoices.create' },
      { label: 'Editar', permission_name: 'invoices.update' },
      { label: 'Eliminar', permission_name: 'invoices.delete' },
      { label: 'Listar', permission_name: 'invoices.list' },
    ]
  },
  {
    name: 'Entradas',
    submenu: [
      { label: 'Crear',  permission_name: 'product_entries.create' },
      { label: 'Editar', permission_name: 'product_entries.update' },
      { label: 'Eliminar', permission_name: 'product_entries.delete' },
      { label: 'Listar', permission_name: 'product_entries.list' },
    ]
  },
  {
    name: 'Salidas',
    submenu: [
      { label: 'Crear',  permission_name: 'product_exits.create' },
      { label: 'Editar', permission_name: 'product_exits.update' },
      { label: 'Eliminar', permission_name: 'product_exits.delete' },
      { label: 'Listar', permission_name: 'product_exits.list' },
    ]
  },
  {
    name: 'Órdenes de Pedido',
    submenu: [
      { label: 'Crear Suficiencia', permission_name: 'orders.create_sf' },
      { label: 'Asignar Número de Orden', permission_name: 'orders.add_order_number' },
      { label: 'Validar Suficiencia', permission_name: 'orders.validate_sf' },
      { label: 'Asignar Partidas', permission_name: 'orders.assign_partidas' },
      { label: 'Recepción en Almacén', permission_name: 'orders.receive' },
      { label: 'Editar', permission_name: 'orders.update' },
      { label: 'Listar', permission_name: 'orders.list' },
      { label: 'Ver', permission_name: 'orders.view' },
      { label: 'Eliminar', permission_name: 'orders.delete' },
    ]
  },
  {
    name: 'Requisiciones',
    submenu: [
      { label: 'Listar', permission_name: 'requisitions.list' },
      { label: 'Ver', permission_name: 'requisitions.view' },
      { label: 'Crear', permission_name: 'requisitions.create' },
      { label: 'Editar', permission_name: 'requisitions.update' },
      { label: 'Aprobar', permission_name: 'requisitions.approve' },
      { label: 'Eliminar', permission_name: 'requisitions.delete' },
    ]
  },
  {
    name: 'Firmantes',
    submenu: [
      { label: 'Listar', permission_name: 'signatory.list' },
      { label: 'Ver', permission_name: 'signatory.view' },
      { label: 'Crear', permission_name: 'signatory.create' },
      { label: 'Editar', permission_name: 'signatory.update' },
      { label: 'Eliminar', permission_name: 'signatory.delete' },
    ]
  },
  {
    name: 'Dashboard',
    submenu: [
      { label: 'Ver', permission_name: 'dashboard.view' },
    ]
  },
  {
    name: 'Estadísticas',
    submenu: [
      { label: 'Ver', permission_name: 'reports.view' },
    ]
  }
];
