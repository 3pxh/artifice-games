import { h, Fragment } from "preact"
import { useContext, useEffect } from "preact/hooks"
import { getFirestore, collection, doc, addDoc, query, where, getDocs, onSnapshot } from "@firebase/firestore";
import { firestore, auth } from "./firebaseClient";
import { AuthContext } from "./AuthProvider"

const getProducts = async () => {
  // const products = await getDocs(query(collection(firestore, "products"), where("active", "==", true)));
  const products = await getDocs(collection(firestore, "products"));
  products.forEach(async p => {
    console.log("Got product", p.data());
    const priceSnap = await getDocs(collection(p.ref, "prices"));
      priceSnap.docs.forEach((doc) => {
        console.log(doc.id, " => ", doc.data());
      });
  })
}

const goToStripe = async () => {
  if (auth.currentUser) {
    const customers = collection(firestore, "customers");
    const checkout = collection(doc(customers, auth.currentUser.uid), "checkout_sessions");
    const r = await addDoc(checkout, {
      mode: "subscription",
      price: "price_1MgrHWBNzXU0egqMl5xNKQtt", // One-time price created in Stripe
      success_url: window.location.origin,
      cancel_url: window.location.origin,
    });
    onSnapshot(r, (snap) => {
      const { error, url } = snap.data()!;
      if (error) {
        console.error(`An error occured: ${error.message}`);
      }
      if (url) {
        window.location.assign(url);
      }
    })
  }
}

export default function Upgrade() {
  const authContext = useContext(AuthContext);
  useEffect(() => {
    getProducts();
  }, []);

  if (authContext.user) {
    return <div class="Upgrade">
      Sup
      <button onClick={goToStripe}>Buy buy buy!!!</button>
    </div>
  } else {
    return <div class="Upgrade">
      No way.
    </div>
  }
}