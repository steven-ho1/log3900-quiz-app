import { ClipboardModule } from '@angular/cdk/clipboard';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { OverlayModule } from '@angular/cdk/overlay';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { QuestionCreationPopupComponent } from '@app/components/question-creation-popup/question-creation-popup.component';
import { AppRoutingModule } from '@app/modules/app-routing.module';
import { AppMaterialModule } from '@app/modules/material.module';
import { AdminJeuPageComponent } from '@app/pages/admin-jeu-page/admin-jeu-page.component';
import { AppComponent } from '@app/pages/app/app.component';
import { GameCreationPageComponent } from '@app/pages/game-creation-page/game-creation-page.component';
import { LobbyPageComponent } from '@app/pages/lobby-page/lobby-page.component';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { LoginFormComponent } from './components/auth/auth-forms/login-form/login-form.component';
import { RegisterFormComponent } from './components/auth/auth-forms/register-form/register-form.component';
import { AuthHeaderComponent } from './components/auth/auth-header/auth-header.component';
import { AvatarSelectorComponent } from './components/auth/avatar-selector/avatar-selector.component';
import { CredentialContainerComponent } from './components/auth/credential-container/credential-container.component';
import { NewPasswordFormComponent } from './components/auth/password-reset-forms/new-password-form/new-password-form.component';
import { ResetCodeFormComponent } from './components/auth/password-reset-forms/reset-code-form/reset-code-form.component';
import { ResetRequestFormComponent } from './components/auth/password-reset-forms/reset-request-form/reset-request-form.component';
import { BlockedPlayerWarningComponent } from './components/blocked-player-warning/blocked-player-warning.component';
import { ButtonResponseComponent } from './components/button-response/button-response.component';
import { ChannelSearchComponent } from './components/chat-components/channel-search/channel-search.component';
import { ChatBoxComponent } from './components/chat-components/chat-box/chat-box.component';
import { CreateChannelDialogComponent } from './components/chat-components/create-channel-dialog/create-channel-dialog.component';
import { ConfirmationPopupComponent } from './components/confirmation-popup/confirmation-popup.component';
import { EndResultComponent } from './components/end-result/end-result.component';
import { GameImportPopupComponent } from './components/game-import-popup/game-import-popup.component';
import { HeaderComponent } from './components/header/header.component';
import { DuolingoComponent } from './components/language-selector/duolingo.component';
import { LoaderComponent } from './components/loader/loader.component';
import { PlayerListComponent } from './components/player-list/player-list.component';
import { ProgressBarComponent } from './components/progress-bar/progress-bar.component';
import { RankingButtonComponent } from './components/ranking-button/ranking-button.component';
import { ShopComponent } from './components/shop/shop.component';
import { FriendsComponent } from './components/user/friends/friends.component';
import { AvatarChangerComponent } from './components/user/profile-option/avatar-changer/avatar-changer.component';
import { MatchHistoryComponent } from './components/user/profile-option/match-history/match-history.component';
import { ProfileComponent } from './components/user/profile-option/profile/profile.component';
import { StatsComponent } from './components/user/profile-option/stats/stats.component';
import { AuthLogsComponent } from './components/user/settings-option/auth-logs/auth-logs.component';
import { SettingsComponent } from './components/user/settings-option/settings/settings.component';
import { UserMenuComponent } from './components/user/user-menu/user-menu.component';
import { ViewCommentsDialogComponent } from './components/view-comments-dialog/view-comments-dialog.component';
import { LoginPageComponent } from './pages/auth/login-page/login-page.component';
import { PasswordResetPageComponent } from './pages/auth/password-reset-page/password-reset-page.component';
import { RegisterPageComponent } from './pages/auth/register-page/register-page.component';
import { HistoryPageComponent } from './pages/history-page/history-page.component';
import { HubPickComponent } from './pages/hub-pick/hub-pick.component';
import { InGamePageComponent } from './pages/in-game-page/in-game-page.component';
import { MainMenuPageComponent } from './pages/main-menu-page/main-menu-page.component';
import { QuestionCreationPageComponent } from './pages/question-creation-page/question-creation-page.component';
import { QuizCreationPageComponent } from './pages/quiz-creation-page/quiz-creation-page.component';
import { RankingPageComponent } from './pages/ranking-page/ranking-page.component';

/**
 * Main module that is used in main.ts.
 * All automatically generated components will appear in this module.
 * Please do not move this module in the module folder.
 * Otherwise Angular Cli will not know in which module to put new component
 */
export const httpLoaderFactory = (http: HttpClient) => {
    return new TranslateHttpLoader(http, './assets/i18n/', '.json');
};

@NgModule({
    declarations: [
        AppComponent,
        AdminJeuPageComponent,
        InGamePageComponent,
        MainMenuPageComponent,
        ProgressBarComponent,
        ButtonResponseComponent,
        QuizCreationPageComponent,
        HeaderComponent,
        QuestionCreationPageComponent,
        GameCreationPageComponent,
        QuestionCreationPopupComponent,
        GameImportPopupComponent,
        LobbyPageComponent,
        ChatBoxComponent,
        EndResultComponent,
        PlayerListComponent,
        HistoryPageComponent,
        ConfirmationPopupComponent,
        LoaderComponent,
        LoginPageComponent,
        RegisterPageComponent,
        AuthHeaderComponent,
        ChatBoxComponent,
        CredentialContainerComponent,
        LoginFormComponent,
        RegisterFormComponent,
        AvatarSelectorComponent,
        UserMenuComponent,
        CreateChannelDialogComponent,
        ProfileComponent,
        SettingsComponent,
        AvatarChangerComponent,
        StatsComponent,
        MatchHistoryComponent,
        HubPickComponent,
        AuthLogsComponent,
        PasswordResetPageComponent,
        ResetRequestFormComponent,
        ResetCodeFormComponent,
        NewPasswordFormComponent,
        ChannelSearchComponent,
        ShopComponent,
        DuolingoComponent,
        ViewCommentsDialogComponent,
        FriendsComponent,
        BlockedPlayerWarningComponent,
        RankingPageComponent,
        RankingButtonComponent,
    ],
    imports: [
        TranslateModule.forRoot({
            loader: {
                provide: TranslateLoader,
                useFactory: httpLoaderFactory,
                deps: [HttpClient],
            },
        }),
        AppMaterialModule,
        AppRoutingModule,
        BrowserAnimationsModule,
        BrowserModule,
        FormsModule,
        HttpClientModule,
        MatProgressSpinnerModule,
        DragDropModule,
        ReactiveFormsModule,
        MatTabsModule,
        MatSlideToggleModule,
        MatInputModule,
        MatIconModule,
        MatSnackBarModule,
        ClipboardModule,
        OverlayModule,
    ],
    providers: [],
    bootstrap: [AppComponent],
})
export class AppModule {}
