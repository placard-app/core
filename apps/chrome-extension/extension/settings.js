import { instanceBase } from "./capture.js"

const input = document.querySelector("#instance")
const status = document.querySelector("#status")
input.value = (await chrome.storage.local.get("instance")).instance ?? ""
document.querySelector("form").addEventListener("submit", async (event) => {
  event.preventDefault()
  try {
    const instance = instanceBase(input.value.trim())
    await chrome.storage.local.set({ instance })
    input.value = instance
    status.textContent = "Saved. Open a place in Google Maps and click Save to Placard."
  } catch (error) {
    status.textContent = error.message
  }
})
