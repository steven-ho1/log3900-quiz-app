export enum ErrorMessage {
    AccessDenied = 'Accès non autorisé ⚠️',
    NetworkError = 'Erreur de connexion au serveur ⚠️',
    UnexpectedError = 'Erreur inattendue ⚠️',
    ExpiredSession = 'Session expirée',
    PointsRangeError = 'Doit être entre 10 et 100',
    PointsMultipleError = 'Doit être un multiple de 10',
    MissingGoodChoiceError = 'Il manque un bon choix',
    MissingBadChoiceError = 'Il manque un mauvais choix',
    GameUnavailable = 'Jeu Indisponible... Rafraîchissement de page',
    PlayerNameUndefinedError = "Votre nom de joueur n'a pas été défini avant le début de la partie",
    InvalidEmail = 'Adresse courriel invalide',
    PasswordConfirmationError = 'Mots de passe non identiques',
    GamesNotFound = 'Les jeux sont introuvables',
    GameNotFound = 'Le jeu demandé est introuvable',
    NotCreator = "Vous n'êtes pas le créateur de ce jeu",
    InvalidRequest = 'Requête invalide',
    VisibilityChange = 'La disponibilité du questionnaire a changé',
}
