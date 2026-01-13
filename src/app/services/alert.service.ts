import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class AlertService {

  constructor() {}

  success(message: string){
    return Swal.fire({
      title: 'Sucesso',
      text: message,
      icon: 'success',
      heightAuto: false
    });
  }

  error(message: string){
    return Swal.fire({
      title: 'Erro',
      text: message,
      icon: 'error',
      target: document.querySelector('ion-app') as HTMLElement,
      confirmButtonText: 'OK',
      heightAuto: false
    });
  }

  question(message: string){
    return Swal.fire({
      title: '',
      text: message,
      icon: 'question',
      confirmButtonText: 'OK',
      heightAuto: false
    });
  }

  toastSuccess(message: string) {
    return Swal.fire({
      icon: 'success',
      title: message,
      toast: true,
      position: 'bottom-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
      heightAuto: false
    });
  }

  toastError(message: string) {
    return Swal.fire({
      icon: 'error',
      title: message,
      toast: true,
      position: 'bottom-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
      heightAuto: false
    });
  }
}

