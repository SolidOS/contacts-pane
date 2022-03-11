import { sym } from "rdflib";
import { default as pane } from "../contactsPane"
import { context, fetcher } from "./context"
import { login } from "solid-ui"
import { authn } from "solid-logic"

const loginBanner = document.getElementById("loginBanner");
const webId = document.getElementById("webId");

loginBanner.appendChild(login.loginStatusBox(document, null, {}));

async function finishLogin() {
  await authn.authSession.handleIncomingRedirect();
  const session = authn.authSession;
  if (session.info.isLoggedIn) {
    // Update the page with the status.
    webId.innerHTML = "Logged in as: " + authn.currentUser().uri;
  } else {
    webId.innerHTML = "";
  }
}

// const webIdToShow = "https://angelo.veltens.org/profile/card#me";
const webIdToShow = "https://testingsolidos.solidcommunity.net/profile/card#me";
// const addressBookToShow = "https://sstratsianis.solidcommunity.net/private/Friends/index.ttl#this"
const addressBookToShow = "https://timbl.com/timbl/Public/Test/Contacts/index.ttl#this";

finishLogin().then(() => { fetcher.load(webIdToShow).then(() => {
  fetcher.load(addressBookToShow).then(() => {
    const app = pane.render(sym(addressBookToShow), context);
    document.getElementById("app").replaceWith(app)
  })
})
})
