"""
This is the main script to run the FastAPI application.
"""
import uvicorn

if __name__ == "__main__":
    # Run the application with uvicorn server
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
