import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class AlertService {

  confirm(title: string, message?: string) {
    return Swal.fire({
      icon: 'question',
      title: title,
      text: message,
      showCancelButton: true,
      confirmButtonText: 'Sim',
      cancelButtonText: 'Não',
      confirmButtonColor: '#34a853',
      cancelButtonColor: '#ea4335'
    });
  }

  transactionSuccess(txId: string, amount: number, fee: number, total: number, networkFee: number) {
    console.log('[AlertService] transactionSuccess chamado');
    const mempoolUrl = `https://mempool.space/tx/${txId}`;

    return Swal.fire({
      icon: 'success',
      title: 'Transação Enviada com Sucesso!',
      html: `
        <div style="text-align: left; font-size: 14px;">
          <p style="margin: 8px 0;"><strong>TXID:</strong></p>
          <div style="background: #f5f5f5; padding: 12px; border-radius: 8px; margin: 8px 0; word-break: break-all; font-family: monospace; font-size: 12px; border: 1px solid #e0e0e0;">
            ${txId}
          </div>
          <div style="margin: 12px 0; padding: 12px; background: #e8f0fe; border-radius: 8px;">
            <p style="margin: 4px 0;"><strong>Valor:</strong> ${amount.toFixed(8)} BTC</p>
            <p style="margin: 4px 0;"><strong>Taxa:</strong> ${fee.toFixed(8)} BTC (${networkFee} satoshis)</p>
            <p style="margin: 4px 0;"><strong>Total:</strong> ${total.toFixed(8)} BTC</p>
          </div>
          <p style="margin-top: 16px; color: #5f6368; font-size: 13px;">A transação está sendo processada pela rede Bitcoin.</p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Ver no Mempool',
      cancelButtonText: 'Copiar TXID',
      confirmButtonColor: '#1a73e8',
      cancelButtonColor: '#5f6368',
      reverseButtons: true,
      width: '90%',
      allowOutsideClick: true,
      allowEscapeKey: true,
      didOpen: () => {
        console.log('[AlertService] Modal transactionSuccess aberto');
      },
      customClass: {
        popup: 'swal2-popup-custom',
        htmlContainer: 'swal2-html-container-custom'
      }
    }).then((result) => {
      console.log('[AlertService] Modal transactionSuccess fechado, resultado:', result);
      if (result.isConfirmed) {
        window.open(mempoolUrl, '_blank');
      } else if (result.dismiss === Swal.DismissReason.cancel) {
        navigator.clipboard.writeText(txId).then(() => {
          Swal.fire({
            icon: 'success',
            title: 'TXID Copiado!',
            text: 'O TXID foi copiado para a área de transferência.',
            timer: 2000,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
          });
        });
      }
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
      timerProgressBar: true
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
      timerProgressBar: true
    });
  }
}

