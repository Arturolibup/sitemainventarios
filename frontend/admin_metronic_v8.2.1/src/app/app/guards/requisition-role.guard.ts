import { CanActivateFn } from '@angular/router';

export const requisitionRoleGuard: CanActivateFn = (route, state) => {
  return true;
};
