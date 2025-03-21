import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ProductDetailService {
  constructor(private _http: HttpClient) {}

  public addToCart(cartItem: any): Observable<any> {
    const headers = new HttpHeaders().set("Content-Type", "application/json");
    return this._http.post<any>('http://localhost:3002/cart', cartItem, { headers }).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: HttpErrorResponse) {
    console.error("Lỗi gọi API:", error);
    return throwError(() => new Error(error.message));
}

}
