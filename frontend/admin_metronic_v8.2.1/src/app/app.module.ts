import { NgModule, APP_INITIALIZER } from '@angular/core';
import { RouterModule } from '@angular/router';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule } from '@angular/common/http';
import { HttpClientInMemoryWebApiModule } from 'angular-in-memory-web-api';
import { ClipboardModule } from 'ngx-clipboard';
import { TranslateModule } from '@ngx-translate/core';
import { InlineSVGModule } from 'ng-inline-svg-2';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AuthService } from './modules/auth/services/auth.service';
import { environment } from 'src/environments/environment';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';
import { LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEsMX from '@angular/common/locales/es-MX';

registerLocaleData(localeEsMX);
// #fake-start#
import { FakeAPIService } from './_fake/fake-api.service';
import { ToastrModule } from 'ngx-toastr';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { OpReceiveComponent } from './modules/ordenpedido/op-receive/op-receive.component';
import { OpReceiveListComponent } from './modules/ordenpedido/op-receive-list/op-receive-list.component';
//import { NumberFormatDirective } from './directives/number-format.directive';
import { AiModule } from '../modules/ai/ai.module';
import { ChatModule } from './modules/chat/chat.module';

// #fake-end#

function appInitializer(authService: AuthService) {
  return () => {
    return new Promise((resolve) => {
      //@ts-ignore
      authService.getUserByToken().subscribe().add(resolve);
    });
  };
}

@NgModule({
  declarations: [
    AppComponent,
    OpReceiveComponent,
    OpReceiveListComponent,
    ],
  imports: [
    BrowserModule,
    RouterModule,
    BrowserAnimationsModule,
    TranslateModule.forRoot(),
    HttpClientModule,
    ClipboardModule,
    ReactiveFormsModule,
    FormsModule,  //agregue ese Forms yo manualmente el dia 27 Enero
    // #fake-start#
    environment.isMockEnabled
      ? HttpClientInMemoryWebApiModule.forRoot(FakeAPIService, {
        passThruUnknownUrl: true,
        dataEncapsulation: false,
      })
      : [],
    // #fake-end#
    AppRoutingModule,
    InlineSVGModule.forRoot(),
    NgbModule,
    SweetAlert2Module.forRoot(),
    ToastrModule.forRoot(),
    AiModule,
    ChatModule
    

  ],
  
  providers: [
    {
      provide: APP_INITIALIZER, 
      useFactory: appInitializer,
      multi: true,
      deps: [AuthService],
    
    },
    {  //inserto el 18abril2025
      provide: LOCALE_ID,
      useValue: 'es-MX'
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule { }
