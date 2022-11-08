"""
A small module for piratical testing of PyScript. ;-)
"""
import random


#: Defines English to Pirate-ish word substitutions.
_PIRATE_WORDS = {
    "hello": "ahoy",
    "hi": "arrr",
    "my": "me",
    "friend": "m'hearty",
    "boy": "laddy",
    "girl": "lassie",
    "sir": "matey",
    "miss": "proud beauty",
    "stranger": "scurvy dog",
    "boss": "foul blaggart",
    "where": "whar",
    "is": "be",
    "the": "th'",
    "you": "ye",
    "old": "barnacle covered",
    "happy": "grog-filled",
    "nearby": "broadside",
    "bathroom": "head",
    "kitchen": "galley",
    "pub": "fleabag inn",
    "stop": "avast",
    "yes": "aye",
    "no": "nay",
    "yay": "yo-ho-ho",
    "money": "doubloons",
    "treasure": "booty",
    "strong": "heave-ho",
    "take": "pillage",
    "drink": "grog",
    "idiot": "scallywag",
    "sea": "briney deep",
    "vote": "mutiny",
    "song": "shanty",
    "drunk": "three sheets to the wind",
    "lol": "yo ho ho",
    "talk": "parley",
    "fail": "scupper",
    "quickly": "smartly",
    "captain": "cap'n",
    "meeting": "parley with rum and cap'n",
}


#: A list of Pirate phrases to randomly insert before or after sentences.
_PIRATE_PHRASES = [
    "batten down the hatches!",
    "splice the mainbrace!",
    "thar she blows!",
    "arrr!",
    "weigh anchor and hoist the mizzen!",
    "savvy?",
    "dead men tell no tales.",
    "cleave him to the brisket!",
    "blimey!",
    "blow me down!",
    "avast ye!",
    "yo ho ho.",
    "shiver me timbers!",
    "blisterin' barnacles!",
    "ye flounderin' nincompoop.",
    "thundering typhoons!",
    "sling yer hook!",
]


def translate(english):
    """
    Take some English text and return a Pirate-ish version thereof.
    """
    # Normalise a list of words (remove whitespace and make lowercase)
    words = [w.lower() for w in english.split()]
    # Substitute some English words with Pirate equivalents.
    result = [_PIRATE_WORDS.get(word, word) for word in words]
    # Capitalize words that begin a sentence and potentially insert a pirate
    # phrase with a chance of 1 in 5.
    capitalize = True
    for i, word in enumerate(result):
        if capitalize:
            result[i] = word[0].upper() + word[1:]
            capitalize = False
        if word[-1] in (".", "!", "?", ":",):
            # It's a word that ends with a sentence ending character.
            capitalize = True
            if random.randint(0, 5) == 0:
                result.insert(i + 1, random.choice(_PIRATE_PHRASES))
    return " ".join(result)

