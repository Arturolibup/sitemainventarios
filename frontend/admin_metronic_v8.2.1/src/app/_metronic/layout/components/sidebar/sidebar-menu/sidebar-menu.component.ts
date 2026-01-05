import { Component, OnInit } from '@angular/core';
import { AuthService } from 'src/app/modules/auth';

@Component({
  selector: 'app-sidebar-menu',
  templateUrl: './sidebar-menu.component.html',
  styleUrls: ['./sidebar-menu.component.scss']
})
export class SidebarMenuComponent implements OnInit {

  user: any;
  isloading: any;
  roles: string[] = [];
 
  constructor(
    public authService: AuthService,
  ) { }
    
  

  ngOnInit(): void {
    this.user = this.authService.user;
    this.roles = this.authService.roles;
  }

  /**
   * ✅ Verifica si el usuario tiene AL MENOS UNO
   * de los roles permitidos para mostrar un menú
   */
  hasAnyRole(allowedRoles: string[]): boolean {
    return this.authService.hasRole(allowedRoles);
  }

}
