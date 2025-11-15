from fastapi import FastAPI
from handlers.recommend import recommend
from models.request import RecommendRequest

def register_routes(app: FastAPI):
    """
    Register HTTP routes on the provided FastAPI application.
    Attaches the following endpoints to `app`:
    - POST /recommend -> the `recommend` handler (expected to be defined in the same module).
    - GET /recommend/user/{user_id} -> a lightweight placeholder handler that returns
        a JSON-like dict indicating a TODO for generating recommendations for the given user.
    Parameters
    ----------
    app : fastapi.FastAPI
            The FastAPI application instance to which routes will be registered.
    Notes
    -----
    - The function assumes a callable named `recommend` exists in the module scope.
    - The GET route currently uses a placeholder lambda and should be replaced
        with a real implementation that generates and returns recommendations.
    Returns
    -------
    None
    """

    # POST /recommend
    app.post("/recommend")(recommend)

    # GET /recommend/user/{user_id}
    app.get("/recommend/user/{user_id}")(lambda user_id: {
        "todo": f"Generate recommendations for user {user_id}"
    })