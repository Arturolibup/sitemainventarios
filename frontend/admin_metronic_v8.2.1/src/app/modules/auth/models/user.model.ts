import { AuthModel } from './auth.model';
import { AddressModel } from './address.model';
import { SocialNetworksModel } from './social-networks.model';
import { environment } from 'src/environments/environment';

export class UserModel extends AuthModel {
  id: number;
  username: string;
  password: string;
  fullname: string;
  email: string;
  pic: string;

   // 🔹 NUEVOS CAMPOS
  area_id?: number;
  area_name?: string;
  subarea_id?: number;
  subarea_name?: string;
  // 👇 Añadir estas propiedades
  avatar?: string | null;       // lo que devuelve la BD: "users/xxxx.jpg"
  avatar_url?: string | null;
  roles: number[] = []; // IDs de roles
  roleName: string; // Nombre del rol principal
  permissions: string[] = []; // Lista de permisos
  token: string; // Agregar token como propiedad
  occupation: string;
  companyName: string;
  phone: string;
  address?: AddressModel;
  socialNetworks?: SocialNetworksModel;
  // personal information
  firstname: string;
  lastname: string;
  name: string;
  surname: string;
  website: string;
  // account information
  language: string;
  timeZone: string;
  communication: {
    email: boolean;
    sms: boolean;
    phone: boolean;

   
  };
  // email settings
  emailSettings?: {
    emailNotification: boolean;
    sendCopyToPersonalEmail: boolean;
    activityRelatesEmail: {
      youHaveNewNotifications: boolean;
      youAreSentADirectMessage: boolean;
      someoneAddsYouAsAsAConnection: boolean;
      uponNewOrder: boolean;
      newMembershipApproval: boolean;
      memberRegistration: boolean;
    };
    updatesFromKeenthemes: {
      newsAboutKeenthemesProductsAndFeatureUpdates: boolean;
      tipsOnGettingMoreOutOfKeen: boolean;
      thingsYouMissedSindeYouLastLoggedIntoKeen: boolean;
      newsAboutMetronicOnPartnerProductsAndOtherServices: boolean;
      tipsOnMetronicBusinessProducts: boolean;
    };
  };

  setUser(_user: unknown) {
    
    const user = _user as any;

    this.id = user.id;
    this.username = user.username || user.mail || '';
    this.password = user.password || '';
   
    this.fullname = user.full_name || user.fullname ||'';
    this.email = user.email || '';
    this.pic = user.pic || './assets/media/avatars/blank.png';
    this.avatar = user.avatar || null;
    // Construir URL completa usando tu backend
    this.avatar_url = user.avatar
      ? `${user.avatar.startsWith('http') ? user.avatar : environment.URL_BACKEND + '/' + user.avatar}`
      : null;

    this.roles = user.roles || []; //Usar solo roles para IDs
    this.roleName = user.role || user.roleName || ''; // Mapear role_name
    
    this.token = user.token || user.access_token || undefined; // Mapear el token
    this.permissions = user.permissions || []; // Mapear permisos por separado
    
    this.occupation = user.occupation || '';
    this.companyName = user.companyName || '';
    this.phone = user.phone || '';
    this.address = user.address;
    this.name = user.name || user.firstname || '';
    this.surname = user.surname || user.lastname || '';
    this.firstname = user.firstname || user.name || '';
    this.lastname = user.lastname || user.surname || '';
    this.socialNetworks = user.socialNetworks;

    this.area_id = user.area_id;
    this.area_name = user.area_name;
    this.subarea_id = user.subarea_id;
    this.subarea_name = user.subarea_name;

    this.website = user.website || '';
    // this.language = user.language || 'en';
    this.timeZone = user.time_zone || 'UTC';

    console.log('UserModel - Permisos asignados desde api:', this.permissions);
    console.log('UserModel - Roles Asignados:', this.roles);
    console.log('UserModel - Nuevos Campos Asignados:', {
      area_id: this.area_id,
      area_name: this.area_name,
      subarea_id: this.subarea_id,
      subarea_name: this.subarea_name
    });
  }
}
