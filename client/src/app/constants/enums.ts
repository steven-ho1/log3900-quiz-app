export enum ImportStates {
    ValidForm = 'ValidForm',
    NameExists = 'NameExists',
    InvalidForm = 'InvalidForm',
}

export enum Route {
    MainMenu = 'main-menu',
    Lobby = 'lobby',
    GameCreation = 'game-creation',
    InGame = 'in-game',
    Admin = 'admin',
    QuizCreation = 'quiz-creation',
    QuestionCreation = 'question-creation',
    HistoryPage = 'history-page',
}

export enum ButtonState {
    Selected = 1,
    Unselected = -1,
}
