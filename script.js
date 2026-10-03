// ===============================
// ELEMENTS
// ===============================

const calendar =
  document.getElementById("calendar");

const monthTitle =
  document.getElementById("month-title");

const todayText =
  document.getElementById("today-text");

const timeText =
  document.getElementById("time-text");

const appointmentTitle =
  document.getElementById("appointment-title");

const eventList =
  document.getElementById("event-list");


const prevButton =
  document.getElementById("prev-month");

const nextButton =
  document.getElementById("next-month");

const addButton =
  document.getElementById("add-btn");


// FORM MODAL

const eventModal =
  document.getElementById("event-modal");

const closeForm =
  document.getElementById("close-form");

const saveButton =
  document.getElementById("save-event");

const formTitle =
  document.getElementById("form-title");


const titleInput =
  document.getElementById("event-title");

const dateInput =
  document.getElementById("event-date");

const startInput =
  document.getElementById("start-time");

const endInput =
  document.getElementById("end-time");

const locationInput =
  document.getElementById("event-location");

const noteInput =
  document.getElementById("event-note");


// DETAIL MODAL

const detailModal =
  document.getElementById("detail-modal");

const closeDetail =
  document.getElementById("close-detail");

const detailTitle =
  document.getElementById("detail-title");

const detailDate =
  document.getElementById("detail-date");

const detailTime =
  document.getElementById("detail-time");

const detailLocation =
  document.getElementById("detail-location");

const detailNote =
  document.getElementById("detail-note");

const editButton =
  document.getElementById("edit-event");

const deleteButton =
  document.getElementById("delete-event");



// ===============================
// DATA
// ===============================

const monthNames = [

  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม"

];


const dayNames = [

  "อา",
  "จ",
  "อ",
  "พ",
  "พฤ",
  "ศ",
  "ส"

];


let today = new Date();


let currentMonth =
  today.getMonth();


let currentYear =
  today.getFullYear();


let selectedDate =
  new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );


let editingEventId = null;

let selectedEventId = null;


let events = JSON.parse(
  localStorage.getItem("planner-events")
) || [];



// ===============================
// DATE UTILITIES
// ===============================

function formatDateKey(date) {

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");


  return `${year}-${month}-${day}`;
}


function dateFromString(value) {

  return new Date(
    value + "T00:00:00"
  );
}


function formatThaiDate(value) {

  const date =
    dateFromString(value);


  return date.toLocaleDateString(
    "th-TH",
    {

      weekday: "long",

      day: "numeric",

      month: "long",

      year: "numeric"

    }
  );
}



// ===============================
// CLOCK
// ===============================

function updateClock() {

  const now =
    new Date();


  const hour =
    String(
      now.getHours()
    ).padStart(2, "0");


  const minute =
    String(
      now.getMinutes()
    ).padStart(2, "0");


  timeText.textContent =
    `${hour}:${minute}`;


  todayText.textContent =
    now.toLocaleDateString(
      "th-TH",
      {

        weekday: "long",

        day: "numeric",

        month: "long",

        year: "numeric"

      }
    );
}


updateClock();

setInterval(
  updateClock,
  1000
);



// ===============================
// SAVE DATA
// ===============================

function saveEvents() {

  localStorage.setItem(

    "planner-events",

    JSON.stringify(events)

  );
}



// ===============================
// CALENDAR
// ===============================

function renderCalendar() {

  calendar.innerHTML = "";


  monthTitle.textContent =
    `${monthNames[currentMonth]}
     ${currentYear + 543}`;


  dayNames.forEach(day => {

    const el =
      document.createElement("div");

    el.className =
      "day-name";

    el.textContent =
      day;

    calendar.appendChild(el);

  });


  const firstDay =
    new Date(
      currentYear,
      currentMonth,
      1
    ).getDay();


  const daysInMonth =
    new Date(
      currentYear,
      currentMonth + 1,
      0
    ).getDate();


  for (
    let i = 0;
    i < firstDay;
    i++
  ) {

    calendar.appendChild(
      document.createElement("div")
    );

  }


  for (
    let day = 1;
    day <= daysInMonth;
    day++
  ) {

    const el =
      document.createElement("div");


    el.className =
      "calendar-day";


    el.textContent =
      day;


    const thisDate =
      new Date(
        currentYear,
        currentMonth,
        day
      );


    const dateKey =
      formatDateKey(thisDate);


    // TODAY

    if (

      day === today.getDate() &&

      currentMonth ===
      today.getMonth() &&

      currentYear ===
      today.getFullYear()

    ) {

      el.classList.add("today");

    }


    // SELECTED

    if (

      day ===
      selectedDate.getDate() &&

      currentMonth ===
      selectedDate.getMonth() &&

      currentYear ===
      selectedDate.getFullYear()

    ) {

      el.classList.add(
        "selected"
      );

    }


    // HAS EVENT

    const hasEvent =
      events.some(
        event =>
          event.date === dateKey
      );


    if (hasEvent) {

      el.classList.add(
        "has-event"
      );

    }


    // CLICK DATE

    el.addEventListener(
      "click",
      () => {

        selectedDate =
          thisDate;


        renderCalendar();

        renderEvents();

        updateAppointmentTitle();

      }
    );


    calendar.appendChild(el);

  }

}



// ===============================
// EVENT TITLE
// ===============================

function updateAppointmentTitle() {

  appointmentTitle.textContent =
    "นัดหมาย • " +
    selectedDate.toLocaleDateString(
      "th-TH",
      {

        weekday: "long",

        day: "numeric",

        month: "long"

      }
    );

}



// ===============================
// EVENT LIST
// ===============================

function renderEvents() {

  eventList.innerHTML = "";


  const selectedKey =
    formatDateKey(
      selectedDate
    );


  const todayEvents =
    events
      .filter(
        event =>
          event.date === selectedKey
      )

      .sort(
        (a, b) =>
          a.startTime.localeCompare(
            b.startTime
          )
      );


  if (
    todayEvents.length === 0
  ) {

    const empty =
      document.createElement("div");


    empty.className =
      "no-event";


    empty.textContent =
      "วันนี้ยังไม่มีนัดหมาย";


    eventList.appendChild(
      empty
    );


    return;

  }


  todayEvents.forEach(event => {

    const card =
      document.createElement("div");


    card.className =
      "event";


    const time =
      document.createElement("div");


    time.className =
      "event-time";


    time.textContent =
      `${event.startTime} - ${event.endTime}`;


    const title =
      document.createElement("span");


    title.className =
      "event-title";


    title.textContent =
      event.title;


    const location =
      document.createElement("span");


    location.className =
      "event-location";


    location.textContent =
      event.location
        ? `📍 ${event.location}`
        : "📍 ไม่ได้ระบุสถานที่";


    card.appendChild(time);

    card.appendChild(title);

    card.appendChild(location);


    card.addEventListener(
      "click",
      () => {

        openEventDetail(
          event.id
        );

      }
    );


    eventList.appendChild(
      card
    );

  });

}



// ===============================
// ADD EVENT
// ===============================

function openAddForm() {

  editingEventId =
    null;


  formTitle.textContent =
    "เพิ่มนัดหมาย";


  saveButton.textContent =
    "บันทึกนัดหมาย";


  titleInput.value =
    "";


  dateInput.value =
    formatDateKey(
      selectedDate
    );


  startInput.value =
    "09:00";


  endInput.value =
    "10:00";


  locationInput.value =
    "";


  noteInput.value =
    "";


  eventModal.classList.add(
    "show"
  );


  titleInput.focus();

}



// ===============================
// EDIT EVENT
// ===============================

function openEditForm(id) {

  const event =
    events.find(
      e =>
        e.id === id
    );


  if (!event) return;


  editingEventId =
    id;


  formTitle.textContent =
    "แก้ไขนัดหมาย";


  saveButton.textContent =
    "บันทึกการแก้ไข";


  titleInput.value =
    event.title;


  dateInput.value =
    event.date;


  startInput.value =
    event.startTime;


  endInput.value =
    event.endTime;


  locationInput.value =
    event.location || "";


  noteInput.value =
    event.note || "";


  detailModal.classList.remove(
    "show"
  );


  eventModal.classList.add(
    "show"
  );

}



// ===============================
// SAVE EVENT
// ===============================

function saveEvent() {

  const title =
    titleInput.value.trim();


  const date =
    dateInput.value;


  const startTime =
    startInput.value;


  const endTime =
    endInput.value;


  const location =
    locationInput.value.trim();


  const note =
    noteInput.value.trim();


  if (!title) {

    alert(
      "กรุณาใส่ชื่อนัดหมาย"
    );

    return;

  }


  if (
    !date ||
    !startTime ||
    !endTime
  ) {

    alert(
      "กรุณาใส่วันที่และเวลา"
    );

    return;

  }


  if (
    endTime < startTime
  ) {

    alert(
      "เวลาสิ้นสุดต้องไม่ก่อนเวลาเริ่ม"
    );

    return;

  }


  if (
    editingEventId
  ) {

    const index =
      events.findIndex(
        event =>
          event.id ===
          editingEventId
      );


    events[index] = {

      ...events[index],

      title,

      date,

      startTime,

      endTime,

      location,

      note

    };

  }

  else {

    events.push({

      id: Date.now(),

      title,

      date,

      startTime,

      endTime,

      location,

      note

    });

  }


  saveEvents();


  const newDate =
    dateFromString(date);


  selectedDate =
    newDate;


  currentMonth =
    newDate.getMonth();


  currentYear =
    newDate.getFullYear();


  eventModal.classList.remove(
    "show"
  );


  renderCalendar();

  renderEvents();

  updateAppointmentTitle();

}



// ===============================
// EVENT DETAIL
// ===============================

function openEventDetail(id) {

  const event =
    events.find(
      e =>
        e.id === id
    );


  if (!event) return;


  selectedEventId =
    id;


  detailTitle.textContent =
    event.title;


  detailDate.textContent =
    formatThaiDate(
      event.date
    );


  detailTime.textContent =
    `${event.startTime} - ${event.endTime}`;


  detailLocation.textContent =
    event.location ||
    "ไม่ได้ระบุสถานที่";


  detailNote.textContent =
    event.note ||
    "ไม่มีรายละเอียดเพิ่มเติม";


  detailModal.classList.add(
    "show"
  );

}



// ===============================
// DELETE
// ===============================

function deleteEvent() {

  const event =
    events.find(
      e =>
        e.id ===
        selectedEventId
    );


  if (!event) return;


  const confirmDelete =
    confirm(
      `ต้องการลบนัด "${event.title}" ใช่หรือไม่?`
    );


  if (!confirmDelete) {

    return;

  }


  events =
    events.filter(
      e =>
        e.id !==
        selectedEventId
    );


  saveEvents();


  detailModal.classList.remove(
    "show"
  );


  selectedEventId =
    null;


  renderCalendar();

  renderEvents();

}



// ===============================
// BUTTONS
// ===============================

addButton.addEventListener(
  "click",
  openAddForm
);


saveButton.addEventListener(
  "click",
  saveEvent
);


closeForm.addEventListener(
  "click",
  () => {

    eventModal.classList.remove(
      "show"
    );

  }
);


closeDetail.addEventListener(
  "click",
  () => {

    detailModal.classList.remove(
      "show"
    );

  }
);


editButton.addEventListener(
  "click",
  () => {

    if (selectedEventId) {

      openEditForm(
        selectedEventId
      );

    }

  }
);


deleteButton.addEventListener(
  "click",
  deleteEvent
);



// ===============================
// MONTH NAVIGATION
// ===============================

prevButton.addEventListener(
  "click",
  () => {

    currentMonth--;


    if (
      currentMonth < 0
    ) {

      currentMonth = 11;

      currentYear--;

    }


    renderCalendar();

  }
);


nextButton.addEventListener(
  "click",
  () => {

    currentMonth++;


    if (
      currentMonth > 11
    ) {

      currentMonth = 0;

      currentYear++;

    }


    renderCalendar();

  }
);



// ===============================
// CLICK OUTSIDE MODAL
// ===============================

eventModal.addEventListener(
  "click",
  event => {

    if (
      event.target ===
      eventModal
    ) {

      eventModal.classList.remove(
        "show"
      );

    }

  }
);


detailModal.addEventListener(
  "click",
  event => {

    if (
      event.target ===
      detailModal
    ) {

      detailModal.classList.remove(
        "show"
      );

    }

  }
);



// ===============================
// START APP
// ===============================

renderCalendar();

renderEvents();

updateAppointmentTitle();