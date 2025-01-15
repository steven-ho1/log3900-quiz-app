export enum ImportStates {
    ValidForm = 'ValidForm',
    NameExists = 'NameExists',
    InvalidForm = 'InvalidForm',
}

export enum Route {
    Login = 'login',
    Register = 'register',
    PasswordReset = 'password-reset',
    MainMenu = 'main-menu',
    Lobby = 'lobby',
    GameCreation = 'game-creation',
    InGame = 'in-game',
    Admin = 'game-admin',
    QuizCreation = 'quiz-creation',
    QuestionCreation = 'question-creation',
    HistoryPage = 'history-page',
    HubPick = 'hub-pick',
    Chat = 'chat',
    Ranking = 'ranking',
}

export enum ButtonState {
    Selected = 1,
    Unselected = -1,
}
