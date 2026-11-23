//! design/features/marks, "The cache" (MK-14): after one page is saved only its entries in the verse index change.

#[expect(
    dead_code,
    reason = "shared test helpers: each test binary uses only some of them"
)]
mod common;

use common::{bible, Scratch};
use wb_core::pageindex;
use wb_core::store::Store;

#[test]
fn saving_one_page_changes_one_entry() {
    let Some(b) = bible() else { return };
    let t = Scratch::new();
    let mut st = Store::open(t.path()).unwrap();
    for i in 0..30 {
        st.jot(&format!("Page {i}\n\nsee Numbers 25:{}", 1 + i % 18), false)
            .unwrap();
    }
    assert_eq!(pageindex::all(&b, &st).len(), 30);
    assert_eq!(st.index.borrow().computed, 30);

    let (loads, computed) = (st.loads, st.index.borrow().computed);
    // one page saved: one file read, one entry worked out
    st.jot("One more\n\nsee Numbers 25:11", false).unwrap();
    assert_eq!(st.loads, loads + 1);
    assert_eq!(pageindex::all(&b, &st).len(), 31);
    assert_eq!(st.index.borrow().computed, computed + 1);

    // one page changed: again one
    let id = st
        .inbox()
        .first()
        .map(|r| wb_core::store::s(r, "id"))
        .unwrap();
    let before = st.loads;
    st.update_jot(&id, Some("Changed\n\nsee Psalm 106:30"), None)
        .unwrap();
    assert_eq!(st.loads, before + 1);
    pageindex::all(&b, &st);
    assert_eq!(st.index.borrow().computed, computed + 2);
}
