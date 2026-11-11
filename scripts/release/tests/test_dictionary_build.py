"""Dictionary parser contracts; synthetic text only, never scripture fixtures."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("dictionary_builder", Path(__file__).parents[2] / "build-dictionary.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


def source(body):
    return ("Ignored publisher preface\n" + builder.START + "\n\n" + body + "\n\n" + builder.END + "\nIgnored publisher footer").encode()


class DictionaryTests(unittest.TestCase):
    def test_preserves_duplicate_senses_aliases_and_wrapped_heading(self):
        entries = builder.parse_entries(source('SAMPLE; EXAMPLE\nSam"ple, n.\n\nFirst sense.\nA wrapped line.\n\nSAMPLE\nSam"ple, v.\n\nSecond sense.\n\nWRAPPED; LONG\nHEADING\nWrapped, n.\n\nLast entry.'))
        self.assertEqual(entries['sample'], 'Sam"ple, n.\n\nFirst sense.\nA wrapped line.\n\nSam"ple, v.\n\nSecond sense.')
        self.assertEqual(entries['example'], 'Sam"ple, n.\n\nFirst sense.\nA wrapped line.')
        self.assertEqual(entries['long heading'], entries['wrapped'])
        self.assertEqual(entries['wrapped'], 'Wrapped, n.\n\nLast entry.')

    def test_internal_tables_stay_in_entry_and_suffixes_are_indexed(self):
        body = 'CHEMISTRY\nChemistry, n.\n\nA table follows:\nRO2 R2O5 RO3 R2O7 RO4 -----------------------------------------------\nTable explanation.\n\nJ .---     P .--.     X -..-\nThe table key.\n\n-ABLY\n-ably, suffix.\n\nA synthetic suffix.\n\nEXAMPLE\nExample, n.\n\nFinal entry.'
        entries = builder.parse_entries(source(body))
        self.assertEqual(set(entries), {'chemistry', '-ably', 'example'})
        self.assertIn('RO2 R2O5', entries['chemistry'])
        self.assertIn('J .---', entries['chemistry'])
        self.assertEqual(entries['-ably'], '-ably, suffix.\n\nA synthetic suffix.')

    def test_transport_newlines_do_not_change_entries(self):
        raw = source('EXAMPLE\nExample, n.\n\nA synthetic definition.')
        self.assertEqual(builder.parse_entries(raw), builder.parse_entries(raw.replace(b'\n', b'\r\r\n')))

    def test_rejects_missing_markers_and_embedded_trademark(self):
        for raw in [b'EXAMPLE\nExample.', source('EXAMPLE\nProject Gutenberg unexpected content.')]:
            with self.assertRaises(ValueError):
                builder.parse_entries(raw)

    def test_existing_output_and_unreviewed_input_are_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder)
            original = path / 'original.txt'
            original.write_bytes(source('EXAMPLE\nExample, n.\n\nSynthetic.'))
            out = path / 'dictionary.db'
            with self.assertRaisesRegex(ValueError, 'SHA-256'):
                builder.build(original, out)
            self.assertFalse(out.exists())
            out.write_bytes(b'existing dictionary')
            with self.assertRaises(FileExistsError):
                builder.build(original, out)
            self.assertEqual(out.read_bytes(), b'existing dictionary')


if __name__ == '__main__':
    unittest.main()
