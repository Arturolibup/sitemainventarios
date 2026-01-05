import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { SIDEBAR } from 'src/app/config/config';
import { RolesService } from '../services/roles.service';

@Component({
  selector: 'app-edit-roles',
  templateUrl: './edit-roles.component.html',
  styleUrls: ['./edit-roles.component.scss']
})
export class EditRolesComponent implements OnInit {

  @Output() RoleE: EventEmitter<any> = new EventEmitter();
  @Input() ROLE_SELECTED: any;

  name: string = '';
  isLoading = false;

  SIDEBAR: any[] = SIDEBAR;

  // 🔐 PERMISOS POR NOMBRE (IGUAL QUE CREATE)
  selectedPermissions: string[] = [];

  constructor(
    public modal: NgbActiveModal,
    private rolesService: RolesService,
    private toast: ToastrService
  ) {}

  ngOnInit(): void {
    if (!this.ROLE_SELECTED) {
      this.toast.error('No se recibió el rol a editar', 'Error');
      this.modal.close();
      return;
    }

    this.name = this.ROLE_SELECTED.name || '';

    // ✅ Precargar permisos actuales del rol (STRINGS)
    if (Array.isArray(this.ROLE_SELECTED.permission_pluck)) {
      this.selectedPermissions = [...this.ROLE_SELECTED.permission_pluck];
    }
  }

  // ===============================
  // TOGGLE POR NOMBRE
  // ===============================
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

  // ===============================
  // GUARDAR
  // ===============================
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

    this.rolesService.updateRole(this.ROLE_SELECTED.id, payload).subscribe({
      next: (resp: any) => {
        this.toast.success('Rol actualizado correctamente', 'Éxito');
        this.RoleE.emit(resp.role);
        this.modal.close();
      },
      error: (err) => {
        console.error(err);
        this.toast.error(err?.error?.message || 'No se pudo actualizar el rol', 'Error');
      },
      complete: () => this.isLoading = false
    });
  }

  hasSelectedPermissions(modulo: any): boolean {
  if (!modulo?.submenu) return false;

  return modulo.submenu.some((sub: any) =>
    this.selectedPermissions.includes(sub.permission_name)
  );
}
countSelected(modulo: any): number {
  if (!modulo?.submenu) return 0;
  return modulo.submenu.filter((sub: any) =>
    this.selectedPermissions.includes(sub.permission_name)
  ).length;
}

getActivePanels(): string[] {
  return this.SIDEBAR
    .map((modulo, index) =>
      this.hasSelectedPermissions(modulo) ? index.toString() : null
    )
    .filter(id => id !== null) as string[];
}
}
