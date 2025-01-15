import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ChatBoxComponent } from '@app/components/chat-components/chat-box/chat-box.component';
import { Route } from '@app/constants/enums';
import { authGuard } from '@app/guards/auth.guard';
import { electronGuard } from '@app/guards/electron.guard';
import { inGameGuard } from '@app/guards/in-game.guard';
import { lobbyGuard } from '@app/guards/lobby.guard';
import { AdminJeuPageComponent } from '@app/pages/admin-jeu-page/admin-jeu-page.component';
import { LoginPageComponent } from '@app/pages/auth/login-page/login-page.component';
import { PasswordResetPageComponent } from '@app/pages/auth/password-reset-page/password-reset-page.component';
import { RegisterPageComponent } from '@app/pages/auth/register-page/register-page.component';
import { GameCreationPageComponent } from '@app/pages/game-creation-page/game-creation-page.component';
import { HistoryPageComponent } from '@app/pages/history-page/history-page.component';
import { HubPickComponent } from '@app/pages/hub-pick/hub-pick.component';
import { InGamePageComponent } from '@app/pages/in-game-page/in-game-page.component';
import { LobbyPageComponent } from '@app/pages/lobby-page/lobby-page.component';
import { MainMenuPageComponent } from '@app/pages/main-menu-page/main-menu-page.component';
import { QuestionCreationPageComponent } from '@app/pages/question-creation-page/question-creation-page.component';
import { QuizCreationPageComponent } from '@app/pages/quiz-creation-page/quiz-creation-page.component';
import { RankingPageComponent } from '@app/pages/ranking-page/ranking-page.component';

const routes: Routes = [
    { path: '', redirectTo: Route.MainMenu, pathMatch: 'full' },
    { path: Route.Login, component: LoginPageComponent, canActivate: [authGuard] },
    { path: Route.Register, component: RegisterPageComponent, canActivate: [authGuard] },
    { path: Route.PasswordReset, component: PasswordResetPageComponent, canActivate: [authGuard] },
    { path: Route.MainMenu, component: MainMenuPageComponent, canActivate: [authGuard] },
    { path: Route.Lobby, component: LobbyPageComponent, canActivate: [authGuard, lobbyGuard] },
    { path: Route.GameCreation, component: GameCreationPageComponent, canActivate: [authGuard] },
    { path: Route.InGame, component: InGamePageComponent, canActivate: [authGuard, inGameGuard] },
    { path: Route.Ranking, component: RankingPageComponent, canActivate: [authGuard] },
    { path: Route.Admin, component: AdminJeuPageComponent, canActivate: [authGuard] },
    { path: Route.QuizCreation, component: QuizCreationPageComponent, canActivate: [authGuard] },
    { path: Route.QuestionCreation, component: QuestionCreationPageComponent, canActivate: [authGuard] },
    { path: Route.HistoryPage, component: HistoryPageComponent, canActivate: [authGuard] },
    { path: Route.HubPick, component: HubPickComponent, canActivate: [authGuard] },
    { path: Route.Chat, component: ChatBoxComponent, canActivate: [electronGuard] },
    { path: '**', redirectTo: Route.MainMenu },
];

@NgModule({
    imports: [RouterModule.forRoot(routes, { useHash: true })],
    exports: [RouterModule],
})
export class AppRoutingModule {}
