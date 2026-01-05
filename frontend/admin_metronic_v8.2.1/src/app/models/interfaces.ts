export interface User {
  id: number;
  name: string;
  surname?: string;
}

export interface Provider {
  id: number;
  full_name: string;
  rfc?: string;
}

export interface Product {
  id: number;
  description: string;
  quantity: number;
  unit_price: number;
}


export interface Area {
  id: number;
  name: string;
}

export interface Subarea {
  id: number;
  name: string;
  area: Area;
}

export interface Marca {
  id: number;
  nombre: string;
}

export interface Tipo {
  id: number;
  nombre: string;
  marca_id: number;
}

export interface Vehicle {
  id: number;
  numero_eco: string;
  subarea?: Subarea;
  marca?: Marca;
  tipo?: Tipo;
  modelo: string;
  placa: string;
  placa_anterior: string;
  cilindro: string;
  numero_serie: string;
  numero_inven: string;
  color: string;
  estado_actual: string;
  estado_asigna: string;
  imagen_vehiculo?: string;
  state: number;
}

// Interfaz para productos
export interface OrderProduct {
  id?: number;
  progresivo: string;
  ur_progressive: string;
  description: string;
  quantity: number;
  unit_id: number;
  unit_price: number;
  amount?: number;
  partida: string;
  brand?: string;
  marca_id?: number;
  tipo_id?: number;
  placa?: string;
  modelo?: string;
  cilindros?: string;
  oficio?: string;
  grupo?: string;
  subgrupo?: string;
  observations?: string;
  received_quantity?: number;
  is_delivered?: boolean;
  selectedProduct?: any; // Temporal, se eliminará en submit
  
}

export interface Order {
    id: number;
    order_number: string;
    date: string;
    date_limited: string;
    user?: { name: string, surname?: string } | null;
    user_name?: string;
    provider?: { full_name: string } | null;
    provider_name?: string;
    process: string;
    status: string;
    status_almacen?: string;
    oficio_origen?: string;
    foliosf?: string;
    general_observations?: string;
    elaboro?: string;
    created_at: string;
    notifications: any[];
    invoices_count?: number;
  }

  export interface DataOrderRequest {
  // Campos normales
  id: number;
  order_number: string;
  foliosf: string;
  process: string;
  date: string;
  status: string;
  }

  export interface PagedResponse<DataOrderRequest> {
  data: DataOrderRequest[];
  meta: {
    total: number;
    per_page?: number;
    current_page?: number;
  };
}