import { Component, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from '../auth.service';
import { Users } from '../../classes/Users';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CartService } from '../cart.service';

@Component({
  selector: 'app-header',
  standalone: true,
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
  imports: [CommonModule, RouterModule]
})
export class HeaderComponent implements OnInit, OnDestroy {
  isLoggedIn = false;
  currentUser: Users | null = null;
  cartCount = 0;

  private authSubscription: Subscription | undefined;
  private userSubscription: Subscription | undefined;
  private cartSubscription: Subscription | undefined;

  constructor(private authService: AuthService, private cartService: CartService) {}

  ngOnInit() {
    this.authSubscription = this.authService.isAuthenticated$.subscribe(
      isAuthenticated => {
        this.isLoggedIn = isAuthenticated;
      }
    );

    this.userSubscription = this.authService.currentUser$.subscribe(
      user => {
        this.currentUser = user as Users;
      }
    );

    this.cartSubscription = this.cartService.cartCount$.subscribe(
      count => {
        this.cartCount = count;
      }
    );
  }

  ngOnDestroy() {
    if (this.authSubscription) this.authSubscription.unsubscribe();
    if (this.userSubscription) this.userSubscription.unsubscribe();
    if (this.cartSubscription) this.cartSubscription.unsubscribe();
  }

  logout() {
    this.authService.logout();
  }
}
