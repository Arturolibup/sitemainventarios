import { Injectable } from '@angular/core';
import { AuthService } from '../../auth/services/auth.service';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class RefactionTraceService {

  constructor(private http: HttpClient,
      private authService: AuthService,
      private router: Router) { }


    }

