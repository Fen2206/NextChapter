const API_KEY = "AIzaSyADODbxNH6h_NGZOFXCAr2HBjRcjCT4mUs";

const input = document.getElementById("search");
const booksDiv = document.getElementById("books");
const statusDiv = document.getElementById("status");

function starsRow(rating) {
  // If no rating, return an empty rating div to keep spacing consistent
  if (rating === undefined || rating === null) {
    return `<div class="rating"></div>`;
  }

  return `
    <div class="rating">
      <span class="star">★</span>
      <span class="rating-num">${Number(rating).toFixed(2)}</span>
    </div>
  `;
}

async function searchBooks(query) {
  statusDiv.textContent = "Searching...";
  booksDiv.innerHTML = "";

  const url =
    "https://www.googleapis.com/books/v1/volumes?q=" +
    encodeURIComponent(query) +
    "&maxResults=10&key=" +
    encodeURIComponent(API_KEY);

  let res, data;
  try {
    res = await fetch(url);
    data = await res.json();
  } catch (e) {
    console.error(e);
    statusDiv.textContent = "Network error";
    return;
  }

  if (!res.ok) {
    statusDiv.textContent = data?.error?.message || "Error searching books";
    return;
  }

  const items = data.items || [];
  statusDiv.textContent = items.length ? `Found ${items.length} books` : "No results";

  items.forEach((item) => {
    const info = item.volumeInfo || {};
    const title = info.title || "Untitled";
    const authors = (info.authors || ["Unknown author"]).join(", ");
    const rating = info.averageRating; // may be undefined

    const thumb =
      info.imageLinks?.thumbnail ||
      info.imageLinks?.smallThumbnail ||
      "";

    const card = document.createElement("div");
    card.className = "book-card";

    card.innerHTML = `
      <div class="cover">
        ${
          thumb
            ? `<img src="${thumb}" alt="${title} cover" loading="lazy" />`
            : `<div class="cover-fallback">No Cover</div>`
        }
      </div>

      <div class="meta">
        <div class="title">${title}</div>
        <div class="author">${authors}</div>
        ${starsRow(rating)}
        <button class="btn" type="button">Begin Reading</button>
      </div>
    `;

    booksDiv.appendChild(card);
  });
}

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const q = input.value.trim();
    if (q) searchBooks(q);
  }
});