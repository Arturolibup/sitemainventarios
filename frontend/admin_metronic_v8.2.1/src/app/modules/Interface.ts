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