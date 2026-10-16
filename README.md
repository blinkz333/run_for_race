# Run to My Love

A small romantic 8-bit wedding runner game built with HTML5 Canvas and vanilla JavaScript.

## Run locally

ES Modules do not work when opening `index.html` directly (file://).
Use a local server:

- VS Code: install **Live Server**, right-click `index.html` > **Open with Live Server**
- Or Python: `python -m http.server 5500` then open http://localhost:5500

## Customize

Edit `src/config.js` to change names, wedding date, difficulty and audio volume.

## Score board (Google Sheet)

After Game Over, players can tap **SAVE SCORE**, type their name and save the run
(name, score, hearts, Pipo, Yum Yum, level, seconds) to a Google Sheet.

1. Create a Google Sheet, then open **Extensions > Apps Script**.
2. Replace the code with `apps-script/Code.gs` and save.
3. Pick `setup` in the function list and press **Run** once (allow the permissions).
   It creates the `Scores` and `Leaderboard` sheets.
4. **Deploy > New deployment > Web app**: Execute as **Me**, Who has access **Anyone**.
5. Copy the web app URL (it ends with `/exec`) into `SCORE_API_URL` in `src/config.js`.

Leave `SCORE_API_URL` empty to hide the SAVE SCORE button.
After changing `Code.gs`, use **Deploy > Manage deployments > Edit > New version**
so the same URL keeps working.
