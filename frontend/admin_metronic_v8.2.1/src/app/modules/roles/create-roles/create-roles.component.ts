import { Component, EventEmitter, Output, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { SIDEBAR } from 'src/app/config/config';
import { RolesService } from '../services/roles.service';

@Component({
  selector: 'app-create-roles',
  templateUrl: './create-roles.component.html',
  styleUrls: ['./create-roles.component.scss']
})
export class CreateRolesComponent implements OnInit {

  @Output() RoleC: EventEmitter<any> = new EventEmitter();

  name: string = '';
  isLoading = false;

  SIDEBAR: any[] = SIDEBAR;

  // 🔐 AHORA POR NOMBRE (CORRECTO)
  selectedPermissions: string[] = [];

  constructor(
    public modal: NgbActiveModal,
    private rolesService: RolesService,
    private toast: ToastrService
  ) {}

  ngOnInit(): void {
    if (!Array.isArray(this.SIDEBAR)) {
    console.log('SIDEBAR inválido', this.SIDEBAR);
    return;
  }
  }

  // Toggle por NOMBRE
  togglePermission(permissionName: string): void {
    const index = this.selectedPermissions.indexOf(permissionName);

    if (index === -1) {
      this.selectedPermissions.push(permissionName);
    } else {
      this.selectedPermissions.splice(index, 1);
    }
  }

  isChecked(permissionName: string): boolean {
    return this.selectedPermissions.includes(permissionName);
  }

  store(): void {
    if (!this.name.trim()) {
      this.toast.error('El nombre del rol es requerido', 'Validación');
      return;
    }

    if (this.selectedPermissions.length === 0) {
      this.toast.error('Debes seleccionar al menos un permiso', 'Validación');
      return;
    }

    const payload = {
      name: this.name.trim(),
      permissions: this.selectedPermissions // 🔥 STRINGS
    };

    this.isLoading = true;

    this.rolesService.registerRole(payload).subscribe({
      next: (resp: any) => {
        this.toast.success('Rol creado correctamente', 'Éxito');
        this.RoleC.emit(resp.role);
        this.modal.close();
      },
      error: (err) => {
        console.error(err);
        this.toast.error(err?.error?.message || 'No se pudo crear el rol', 'Error');
      },
      complete: () => this.isLoading = false
    });
  }
}
