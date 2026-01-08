import { Injectable } from '@angular/core';
import * as bitcoin from 'bitcoinjs-lib';
import { initEccLib } from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import { Buffer } from 'buffer';

export type AddressType = 'segwit' | 'taproot';

export interface Wallet {
  id: string;
  name: string;
  address: string;
  privateKey: string;
  seed: string[];
  addressType: AddressType;
  createdAt: number;
}

@Injectable({
  providedIn: 'root'
})
export class WalletService {
  private network = bitcoin.networks.bitcoin;
  private ECPair = ECPairFactory(ecc);

  constructor() {
    initEccLib(ecc);
  }
  private readonly wordList: string[] = [
    'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract',
    'absurd', 'abuse', 'access', 'accident', 'account', 'accuse', 'achieve', 'acid',
    'acoustic', 'acquire', 'across', 'act', 'action', 'actor', 'actual', 'adapt',
    'add', 'addict', 'address', 'adjust', 'admit', 'adult', 'advance', 'advice',
    'aerobic', 'affair', 'afford', 'afraid', 'again', 'age', 'agent', 'agree',
    'ahead', 'aim', 'air', 'airport', 'aisle', 'alarm', 'album', 'alcohol',
    'alert', 'alien', 'all', 'alley', 'allow', 'almost', 'alone', 'alpha',
    'already', 'also', 'alter', 'always', 'amateur', 'amazing', 'among', 'amount',
    'amused', 'analyst', 'anchor', 'ancient', 'anger', 'angle', 'angry', 'animal',
    'ankle', 'announce', 'annual', 'another', 'answer', 'antenna', 'antique', 'anxiety',
    'any', 'apart', 'apology', 'appear', 'apple', 'approve', 'april', 'area',
    'arena', 'argue', 'arm', 'armed', 'armor', 'army', 'around', 'arrange',
    'arrest', 'arrive', 'arrow', 'art', 'article', 'artist', 'artwork', 'ask',
    'aspect', 'assault', 'asset', 'assist', 'assume', 'asthma', 'athlete', 'atom',
    'attack', 'attend', 'attitude', 'attract', 'auction', 'audit', 'august', 'aunt',
    'author', 'auto', 'autumn', 'average', 'avocado', 'avoid', 'awake', 'aware',
    'away', 'awesome', 'awful', 'awkward', 'axis', 'baby', 'bachelor', 'bacon',
    'badge', 'bag', 'balance', 'balcony', 'ball', 'bamboo', 'banana', 'banner',
    'bar', 'barely', 'bargain', 'barrel', 'base', 'basic', 'basket', 'battle',
    'beach', 'bean', 'beauty', 'because', 'become', 'beef', 'before', 'begin',
    'behave', 'behind', 'believe', 'below', 'belt', 'bench', 'benefit', 'best',
    'betray', 'better', 'between', 'beyond', 'bicycle', 'bid', 'bike', 'bind',
    'biology', 'bird', 'birth', 'bitter', 'black', 'blade', 'blame', 'blanket',
    'blast', 'bleak', 'bless', 'blind', 'blood', 'blossom', 'blow', 'blue',
    'blur', 'blush', 'board', 'boat', 'body', 'boil', 'bomb', 'bone',
    'bonus', 'book', 'boost', 'border', 'boring', 'borrow', 'boss', 'bottom',
    'bounce', 'box', 'boy', 'bracket', 'brain', 'brand', 'brass', 'brave',
    'bread', 'breeze', 'brick', 'bridge', 'brief', 'bright', 'bring', 'brisk',
    'broccoli', 'broken', 'bronze', 'broom', 'brother', 'brown', 'brush', 'bubble',
    'buddy', 'budget', 'buffalo', 'build', 'bulb', 'bulk', 'bullet', 'bundle',
    'bunker', 'burden', 'burger', 'burst', 'bus', 'business', 'busy', 'butter',
    'buyer', 'buzz', 'cabbage', 'cabin', 'cable', 'cactus', 'cage', 'cake',
    'call', 'calm', 'camera', 'camp', 'can', 'canal', 'cancel', 'candy',
    'cannon', 'canoe', 'canvas', 'canyon', 'capable', 'capital', 'captain', 'car',
    'carbon', 'card', 'care', 'career', 'careful', 'careless', 'cargo', 'carpet',
    'carry', 'cart', 'case', 'cash', 'casino', 'cast', 'casual', 'cat',
    'catalog', 'catch', 'category', 'cattle', 'caught', 'cause', 'caution', 'cave',
    'ceiling', 'celery', 'cement', 'census', 'century', 'cereal', 'certain', 'chair',
    'chalk', 'champion', 'change', 'chaos', 'chapter', 'charge', 'chase', 'chat',
    'cheap', 'check', 'cheese', 'chef', 'cherry', 'chest', 'chicken', 'chief',
    'child', 'chimney', 'choice', 'choose', 'chronic', 'chuckle', 'chunk', 'churn',
    'cigar', 'cinnamon', 'circle', 'citizen', 'city', 'civil', 'claim', 'clamp',
    'clarify', 'claw', 'clay', 'clean', 'clerk', 'clever', 'click', 'client',
    'cliff', 'climb', 'clinic', 'clip', 'clock', 'clog', 'close', 'cloth',
    'cloud', 'clown', 'club', 'clump', 'cluster', 'clutch', 'coach', 'coast',
    'coconut', 'code', 'coffee', 'coil', 'coin', 'collect', 'color', 'column',
    'combine', 'come', 'comfort', 'comic', 'common', 'company', 'concert', 'conduct',
    'confirm', 'congress', 'connect', 'consider', 'control', 'convince', 'cook', 'cool',
    'copper', 'copy', 'coral', 'core', 'corn', 'correct', 'cost', 'cotton',
    'couch', 'country', 'couple', 'course', 'cousin', 'cover', 'coyote', 'crack',
    'cradle', 'craft', 'cram', 'crane', 'crash', 'crater', 'crawl', 'crazy',
    'cream', 'credit', 'creek', 'crew', 'cricket', 'crime', 'crisp', 'critic',
    'crop', 'cross', 'crouch', 'crowd', 'crucial', 'cruel', 'cruise', 'crumble',
    'crunch', 'crush', 'cry', 'crystal', 'cube', 'culture', 'cup', 'cupboard',
    'curious', 'current', 'curtain', 'curve', 'cushion', 'custom', 'cute', 'cycle',
    'dad', 'damage', 'damp', 'dance', 'danger', 'daring', 'dark', 'dash',
    'daughter', 'dawn', 'day', 'deal', 'debate', 'debris', 'decade', 'december',
    'decide', 'decline', 'decorate', 'decrease', 'deer', 'defense', 'define', 'defy',
    'degree', 'delay', 'deliver', 'demand', 'demise', 'denial', 'dentist', 'deny',
    'depart', 'depend', 'deposit', 'depth', 'deputy', 'derive', 'describe', 'desert',
    'design', 'desk', 'despair', 'destroy', 'detail', 'detect', 'develop', 'device',
    'devote', 'diagram', 'dial', 'diamond', 'diary', 'dice', 'diesel', 'diet',
    'differ', 'digital', 'dignity', 'dilemma', 'dinner', 'dinosaur', 'direct', 'dirt',
    'disagree', 'discover', 'disease', 'dish', 'dismiss', 'disorder', 'display', 'distance',
    'divert', 'divide', 'divorce', 'dizzy', 'doctor', 'document', 'dog', 'doll',
    'dolphin', 'domain', 'donate', 'donkey', 'donor', 'door', 'dose', 'double',
    'dove', 'draft', 'dragon', 'drama', 'drastic', 'draw', 'dream', 'dress',
    'drift', 'drill', 'drink', 'drip', 'drive', 'drop', 'drum', 'dry',
    'duck', 'dumb', 'dune', 'during', 'dust', 'dutch', 'duty', 'dwarf',
    'dynamic', 'eager', 'eagle', 'early', 'earn', 'earth', 'easily', 'east',
    'easy', 'echo', 'ecology', 'economy', 'edge', 'edit', 'educate', 'effort',
    'egg', 'eight', 'either', 'elbow', 'elder', 'electric', 'elegant', 'element',
    'elephant', 'elevator', 'elite', 'else', 'embark', 'embody', 'embrace', 'emerge',
    'emotion', 'employ', 'empower', 'empty', 'enable', 'enact', 'end', 'endless',
    'endorse', 'enemy', 'energy', 'enforce', 'engage', 'engine', 'enhance', 'enjoy',
    'enlist', 'enough', 'enrich', 'enroll', 'ensure', 'enter', 'entire', 'entry',
    'envelope', 'episode', 'equal', 'equip', 'era', 'erase', 'erode', 'erosion',
    'error', 'erupt', 'escape', 'essay', 'essence', 'estate', 'eternal', 'ethics',
    'evidence', 'evil', 'evoke', 'evolve', 'exact', 'example', 'exceed', 'excel',
    'exception', 'excess', 'exchange', 'excite', 'exclude', 'excuse', 'execute', 'exercise',
    'exhaust', 'exhibit', 'exile', 'exist', 'exit', 'exotic', 'expand', 'expect',
    'expire', 'explain', 'expose', 'express', 'extend', 'extra', 'eye', 'eyebrow',
    'fabric', 'face', 'faculty', 'fade', 'faint', 'faith', 'fall', 'false',
    'fame', 'family', 'famous', 'fan', 'fancy', 'fantasy', 'farm', 'fashion',
    'fat', 'fatal', 'father', 'fatigue', 'fault', 'favorite', 'feature', 'february',
    'federal', 'fee', 'feed', 'feel', 'female', 'fence', 'festival', 'fetch',
    'fever', 'few', 'fiber', 'fiction', 'field', 'figure', 'file', 'film',
    'filter', 'final', 'find', 'fine', 'finger', 'finish', 'fire', 'firm',
    'first', 'fiscal', 'fish', 'fit', 'fitness', 'fix', 'flag', 'flame',
    'flash', 'flat', 'flavor', 'flee', 'flight', 'flip', 'float', 'flock',
    'floor', 'flower', 'fluid', 'flush', 'fly', 'foam', 'focus', 'fog',
    'foil', 'fold', 'follow', 'food', 'foot', 'force', 'forest', 'forget',
    'fork', 'fortune', 'forum', 'forward', 'fossil', 'foster', 'found', 'fox',
    'fragile', 'frame', 'frequent', 'fresh', 'friend', 'fringe', 'frog', 'front',
    'frost', 'frown', 'frozen', 'fruit', 'fuel', 'fun', 'funny', 'furnace',
    'fury', 'future', 'gadget', 'gain', 'galaxy', 'gallery', 'game', 'gap',
    'garage', 'garbage', 'garden', 'garlic', 'garment', 'gas', 'gasp', 'gate',
    'gather', 'gauge', 'gaze', 'general', 'genius', 'genre', 'gentle', 'genuine',
    'gesture', 'ghost', 'giant', 'gift', 'giggle', 'ginger', 'giraffe', 'girl',
    'give', 'glad', 'glance', 'glare', 'glass', 'glide', 'glimpse', 'globe',
    'gloom', 'glory', 'glove', 'glow', 'glue', 'goat', 'goddess', 'gold',
    'good', 'goose', 'gorilla', 'gospel', 'gossip', 'govern', 'gown', 'grab',
    'grace', 'grain', 'grant', 'grape', 'grass', 'gravity', 'great', 'green',
    'grid', 'grief', 'grit', 'grocery', 'group', 'grow', 'grunt', 'guard',
    'guess', 'guide', 'guilt', 'guitar', 'gun', 'gym', 'habit', 'hair',
    'half', 'hammer', 'hamster', 'hand', 'happy', 'harbor', 'hard', 'harsh',
    'harvest', 'hat', 'have', 'hawk', 'hazard', 'head', 'health', 'hear',
    'heart', 'heavy', 'hedgehog', 'height', 'hello', 'helmet', 'help', 'hen',
    'hero', 'hidden', 'high', 'hill', 'hint', 'hip', 'hire', 'history',
    'hobby', 'hockey', 'hold', 'hole', 'holiday', 'hollow', 'home', 'honey',
    'hood', 'hope', 'horn', 'horror', 'horse', 'hospital', 'host', 'hotel',
    'hour', 'hover', 'hub', 'huge', 'human', 'humble', 'humor', 'hundred',
    'hungry', 'hunt', 'hurdle', 'hurry', 'hurt', 'husband', 'hybrid', 'ice',
    'icon', 'idea', 'identify', 'idle', 'ignore', 'ill', 'illegal', 'illness',
    'image', 'imitate', 'immense', 'immune', 'impact', 'impose', 'improve', 'impulse',
    'inch', 'include', 'income', 'increase', 'index', 'indicate', 'indoor', 'industry',
    'infant', 'inflict', 'inform', 'inhale', 'inherit', 'initial', 'inject', 'injury',
    'inmate', 'inner', 'innocent', 'input', 'inquiry', 'insane', 'insect', 'inside',
    'inspire', 'install', 'intact', 'interest', 'into', 'invest', 'invite', 'involve',
    'iron', 'island', 'isolate', 'issue', 'item', 'ivory', 'jacket', 'jaguar',
    'jar', 'jazz', 'jealous', 'jeans', 'jelly', 'jewel', 'job', 'join',
    'joke', 'journey', 'joy', 'judge', 'juice', 'jump', 'june', 'jungle',
    'junior', 'junk', 'just', 'kangaroo', 'keen', 'keep', 'ketchup', 'key',
    'kick', 'kid', 'kidney', 'kind', 'kingdom', 'kiss', 'kit', 'kitchen',
    'kite', 'kitten', 'kiwi', 'knee', 'knife', 'knock', 'know', 'lab',
    'label', 'labor', 'ladder', 'lady', 'lake', 'lamp', 'language', 'laptop',
    'large', 'later', 'latin', 'laugh', 'laundry', 'lava', 'law', 'lawn',
    'lawsuit', 'layer', 'lazy', 'leader', 'leaf', 'learn', 'leave', 'lecture',
    'left', 'leg', 'legal', 'legend', 'leisure', 'lemon', 'lend', 'length',
    'lens', 'leopard', 'lesson', 'letter', 'level', 'liar', 'liberty', 'library',
    'license', 'life', 'lift', 'light', 'like', 'limb', 'limit', 'link',
    'lion', 'liquid', 'list', 'little', 'live', 'lizard', 'load', 'loan',
    'lobster', 'local', 'lock', 'logic', 'lonely', 'long', 'loop', 'lottery',
    'loud', 'lounge', 'love', 'loyal', 'lucky', 'luggage', 'lumber', 'lunar',
    'lunch', 'luxury', 'lyrics', 'machine', 'mad', 'magic', 'magnet', 'maid',
    'mail', 'main', 'major', 'make', 'mammal', 'man', 'manage', 'mandate',
    'mango', 'mansion', 'manual', 'maple', 'marble', 'march', 'margin', 'marine',
    'market', 'marriage', 'mask', 'mass', 'master', 'match', 'material', 'math',
    'matrix', 'matter', 'maximum', 'maze', 'meadow', 'mean', 'measure', 'meat',
    'mechanic', 'medal', 'media', 'melody', 'melt', 'member', 'memory', 'mention',
    'menu', 'mercy', 'merge', 'merit', 'merry', 'mesh', 'message', 'metal',
    'method', 'middle', 'midnight', 'milk', 'million', 'mimic', 'mind', 'minimum',
    'minor', 'minute', 'miracle', 'mirror', 'misery', 'miss', 'mistake', 'mix',
    'mixed', 'mixture', 'mobile', 'model', 'modify', 'mom', 'moment', 'monitor',
    'monkey', 'monster', 'month', 'moon', 'moral', 'more', 'morning', 'mosquito',
    'mother', 'motion', 'motor', 'mountain', 'mouse', 'move', 'movie', 'much',
    'muffin', 'mule', 'multiply', 'muscle', 'museum', 'mushroom', 'music', 'must',
    'mutual', 'myself', 'mystery', 'myth', 'naive', 'name', 'napkin', 'narrow',
    'nasty', 'nation', 'nature', 'near', 'neck', 'need', 'negative', 'neglect',
    'neither', 'nephew', 'nerve', 'nest', 'net', 'network', 'neutral', 'never',
    'news', 'next', 'nice', 'night', 'noble', 'noise', 'nominee', 'noodle',
    'normal', 'north', 'nose', 'notable', 'note', 'nothing', 'notice', 'novel',
    'now', 'nuclear', 'number', 'nurse', 'nut', 'oak', 'obey', 'object',
    'oblige', 'obscure', 'observe', 'obtain', 'obvious', 'occur', 'ocean', 'october',
    'odor', 'off', 'offer', 'office', 'often', 'oil', 'okay', 'old',
    'olive', 'olympic', 'omit', 'once', 'one', 'onion', 'online', 'only',
    'open', 'opera', 'opinion', 'oppose', 'option', 'orange', 'orbit', 'orchard',
    'order', 'ordinary', 'organ', 'orient', 'original', 'orphan', 'ostrich', 'other',
    'outdoor', 'outer', 'output', 'outside', 'oval', 'oven', 'over', 'own',
    'owner', 'oxygen', 'oyster', 'ozone', 'pact', 'paddle', 'page', 'pair',
    'palace', 'palm', 'panda', 'panel', 'panic', 'panther', 'paper', 'parade',
    'parent', 'park', 'parrot', 'party', 'pass', 'patch', 'path', 'patient',
    'patrol', 'pattern', 'pause', 'pave', 'payment', 'peace', 'peanut', 'pear',
    'peasant', 'pelican', 'pen', 'penalty', 'pencil', 'people', 'pepper', 'perfect',
    'permit', 'person', 'pet', 'phone', 'photo', 'phrase', 'physical', 'piano',
    'picnic', 'picture', 'piece', 'pig', 'pigeon', 'pill', 'pilot', 'pink',
    'pioneer', 'pipe', 'pistol', 'pitch', 'pizza', 'place', 'planet', 'plastic',
    'plate', 'play', 'please', 'pledge', 'pluck', 'plug', 'plunge', 'poem',
    'poet', 'point', 'polar', 'pole', 'police', 'pond', 'pony', 'pool',
    'popular', 'portion', 'position', 'possible', 'post', 'potato', 'pottery', 'poverty',
    'powder', 'power', 'practice', 'praise', 'predict', 'prefer', 'prepare', 'present',
    'pretty', 'prevent', 'price', 'pride', 'primary', 'print', 'priority', 'prison',
    'private', 'prize', 'problem', 'process', 'produce', 'profit', 'program', 'project',
    'promote', 'proof', 'property', 'prosper', 'protect', 'proud', 'provide', 'public',
    'pudding', 'pull', 'pulp', 'pulse', 'pumpkin', 'punch', 'pupil', 'puppy',
    'purchase', 'purity', 'purpose', 'purse', 'push', 'put', 'puzzle', 'pyramid',
    'quality', 'quantum', 'quarter', 'question', 'quick', 'quit', 'quiz', 'quote',
    'rabbit', 'raccoon', 'race', 'rack', 'radar', 'radio', 'rail', 'rain',
    'raise', 'rally', 'ramp', 'ranch', 'random', 'range', 'rapid', 'rare',
    'rate', 'rather', 'raven', 'raw', 'razor', 'ready', 'real', 'reason',
    'rebel', 'rebuild', 'recall', 'receive', 'recipe', 'record', 'recycle', 'reduce',
    'reflect', 'reform', 'refuse', 'region', 'regret', 'regular', 'reject', 'relax',
    'release', 'relief', 'rely', 'remain', 'remember', 'remind', 'remove', 'render',
    'renew', 'rent', 'reopen', 'repair', 'repeat', 'replace', 'reply', 'report',
    'require', 'rescue', 'resemble', 'resist', 'resource', 'response', 'result', 'retire',
    'retreat', 'return', 'reunion', 'reveal', 'review', 'reward', 'rhythm', 'rib',
    'ribbon', 'rice', 'rich', 'ride', 'ridge', 'rifle', 'right', 'rigid',
    'ring', 'riot', 'rip', 'ripe', 'rise', 'risk', 'rival', 'river',
    'road', 'roast', 'robot', 'robust', 'rocket', 'romance', 'roof', 'rookie',
    'room', 'rose', 'rotate', 'rough', 'round', 'route', 'royal', 'rubber',
    'rude', 'rug', 'rule', 'run', 'runway', 'rural', 'sad', 'saddle',
    'sadness', 'safe', 'sail', 'salad', 'salmon', 'salon', 'salt', 'same',
    'sample', 'sand', 'satisfy', 'satoshi', 'sauce', 'sausage', 'save', 'say',
    'scale', 'scan', 'scare', 'scatter', 'scene', 'scheme', 'school', 'science',
    'scissors', 'scorpion', 'scout', 'scrap', 'screen', 'script', 'scrub', 'sea',
    'search', 'season', 'seat', 'second', 'secret', 'section', 'security', 'seed',
    'seek', 'segment', 'select', 'sell', 'seminar', 'senior', 'sense', 'sentence',
    'series', 'service', 'session', 'settle', 'setup', 'seven', 'shadow', 'shaft',
    'shallow', 'share', 'shed', 'shell', 'sheriff', 'shield', 'shift', 'shine',
    'ship', 'shiver', 'shock', 'shoe', 'shoot', 'shop', 'short', 'shoulder',
    'shove', 'shrimp', 'shrug', 'shuffle', 'shy', 'sibling', 'sick', 'side',
    'siege', 'sight', 'sign', 'silent', 'silk', 'silly', 'silver', 'similar',
    'simple', 'since', 'sing', 'siren', 'sister', 'situate', 'six', 'size',
    'skate', 'sketch', 'ski', 'skill', 'skin', 'skirt', 'skull', 'slab',
    'slam', 'sleep', 'slender', 'slice', 'slide', 'slight', 'slim', 'slogan',
    'slot', 'slow', 'slush', 'small', 'smart', 'smile', 'smoke', 'smooth',
    'snack', 'snake', 'snap', 'sniff', 'snow', 'soap', 'soccer', 'social',
    'sock', 'soda', 'soft', 'solar', 'soldier', 'solid', 'solution', 'solve',
    'someone', 'song', 'soon', 'sorry', 'sort', 'soul', 'sound', 'soup',
    'source', 'south', 'space', 'spare', 'spatial', 'spawn', 'speak', 'special',
    'speed', 'spell', 'spend', 'sphere', 'spice', 'spider', 'spike', 'spin',
    'spirit', 'split', 'spoil', 'sponsor', 'spoon', 'sport', 'spot', 'spray',
    'spread', 'spring', 'spy', 'square', 'squeeze', 'squirrel', 'stable', 'stadium',
    'staff', 'stage', 'stain', 'stairs', 'stamp', 'stand', 'start', 'state',
    'stay', 'steak', 'steel', 'stem', 'step', 'stereo', 'stick', 'still',
    'sting', 'stock', 'stomach', 'stone', 'stool', 'story', 'stove', 'strategy',
    'street', 'strike', 'strong', 'struggle', 'student', 'stuff', 'stumble', 'style',
    'subject', 'submit', 'subway', 'success', 'such', 'sudden', 'suffer', 'sugar',
    'suggest', 'suit', 'summer', 'sun', 'sunny', 'sunset', 'super', 'supply',
    'support', 'sure', 'surface', 'surge', 'surprise', 'surround', 'survey', 'suspect',
    'sustain', 'swallow', 'swamp', 'swap', 'swarm', 'swear', 'sweet', 'swift',
    'swim', 'swing', 'switch', 'sword', 'symbol', 'symptom', 'syrup', 'system',
    'table', 'tackle', 'tag', 'tail', 'talent', 'talk', 'tank', 'tape',
    'target', 'task', 'taste', 'tattoo', 'taxi', 'teach', 'team', 'tell',
    'ten', 'tenant', 'tennis', 'tent', 'term', 'test', 'text', 'thank',
    'that', 'theme', 'then', 'theory', 'there', 'they', 'thing', 'this',
    'thought', 'three', 'thrive', 'throw', 'thumb', 'thunder', 'ticket', 'tide',
    'tiger', 'tilt', 'timber', 'time', 'tiny', 'tip', 'tired', 'tissue',
    'title', 'toast', 'tobacco', 'today', 'toddler', 'toe', 'together', 'toilet',
    'token', 'tomato', 'tomorrow', 'tone', 'tongue', 'tonight', 'tool', 'tooth',
    'top', 'topic', 'topple', 'torch', 'tornado', 'tortoise', 'toss', 'total',
    'toucan', 'touch', 'tough', 'tour', 'town', 'toy', 'track', 'trade',
    'traffic', 'tragic', 'train', 'transfer', 'trap', 'trash', 'travel', 'tray',
    'treat', 'tree', 'trend', 'trial', 'tribe', 'trick', 'trigger', 'trim',
    'trip', 'trophy', 'trouble', 'truck', 'true', 'truly', 'trumpet', 'trust',
    'truth', 'try', 'tube', 'tuition', 'tumble', 'tuna', 'tunnel', 'turkey',
    'turn', 'turtle', 'twelve', 'twenty', 'twice', 'twin', 'twist', 'two',
    'type', 'typical', 'ugly', 'umbrella', 'unable', 'unaware', 'uncle', 'uncover',
    'under', 'undo', 'unfair', 'unfold', 'unhappy', 'uniform', 'unique', 'unit',
    'universe', 'unknown', 'unlock', 'until', 'unusual', 'unveil', 'update', 'upgrade',
    'uphold', 'upon', 'upper', 'upset', 'urban', 'urge', 'usage', 'use',
    'used', 'useful', 'useless', 'usual', 'utility', 'vacant', 'vacuum', 'vague',
    'valid', 'valley', 'valve', 'van', 'vanish', 'vapor', 'various', 'vast',
    'vault', 'vehicle', 'velvet', 'vendor', 'venture', 'venue', 'verb', 'verify',
    'version', 'very', 'vessel', 'veteran', 'viable', 'vibrant', 'vicious', 'victory',
    'video', 'view', 'village', 'vintage', 'violin', 'virtual', 'virus', 'visa',
    'visit', 'visual', 'vital', 'vivid', 'vocal', 'voice', 'void', 'volcano',
    'volume', 'vote', 'voyage', 'wage', 'wagon', 'wait', 'walk', 'wall',
    'walnut', 'want', 'warfare', 'warm', 'warrior', 'wash', 'wasp', 'waste',
    'water', 'wave', 'way', 'wealth', 'weapon', 'weasel', 'weather', 'web',
    'wedding', 'weekend', 'weird', 'welcome', 'west', 'wet', 'whale', 'what',
    'wheat', 'wheel', 'when', 'where', 'whip', 'whisper', 'wide', 'width',
    'wife', 'wild', 'will', 'win', 'window', 'wine', 'wing', 'wink',
    'winner', 'winter', 'wire', 'wisdom', 'wise', 'wish', 'witness', 'wolf',
    'woman', 'wonder', 'wood', 'wool', 'word', 'work', 'world', 'worry',
    'worth', 'would', 'wound', 'wrap', 'wreck', 'wrestle', 'wrist', 'write',
    'wrong', 'yard', 'year', 'yellow', 'you', 'young', 'youth', 'zebra',
    'zero', 'zone', 'zoo'
  ];

  generateSeed(): string[] {
    const seed: string[] = [];
    const array = new Uint32Array(12);
    crypto.getRandomValues(array);

    for (let i = 0; i < 12; i++) {
      const index = array[i] % this.wordList.length;
      seed.push(this.wordList[index]);
    }

    return seed;
  }

  async generateWalletFromSeed(seed: string[], name: string, addressType: AddressType = 'segwit'): Promise<Wallet> {
    try {
      const seedString = seed.join(' ');
      const encoder = new TextEncoder();
      const data = encoder.encode(seedString);

      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      let privateKeyHex = hashHex.substring(0, 64);
      while (privateKeyHex.length < 64) {
        privateKeyHex += '0';
      }
      if (privateKeyHex.length > 64) {
        privateKeyHex = privateKeyHex.substring(0, 64);
      }

      const address = await this.generateAddressFromPrivateKey(privateKeyHex, addressType);

      const wallet = {
        id: this.generateId(),
        name,
        address,
        privateKey: privateKeyHex,
        seed,
        addressType,
        createdAt: Date.now()
      };

      return wallet;
    } catch (error: any) {
      console.error('Erro em generateWalletFromSeed:', error);
      throw error;
    }
  }

  async generateWalletFromPrivateKey(privateKey: string, name: string, addressType: AddressType = 'segwit'): Promise<Wallet> {
    let normalizedKey = privateKey.trim().replace(/^0x/i, '').replace(/\s/g, '');

    if (normalizedKey.length < 64) {
      normalizedKey = normalizedKey.padEnd(64, '0');
    } else if (normalizedKey.length > 64) {
      normalizedKey = normalizedKey.substring(0, 64);
    }

    const address = await this.generateAddressFromPrivateKey(normalizedKey, addressType);

    return {
      id: this.generateId(),
      name,
      address,
      privateKey: normalizedKey,
      seed: [],
      addressType,
      createdAt: Date.now()
    };
  }

  private async generateAddressFromPrivateKey(privateKey: string, addressType: AddressType = 'segwit'): Promise<string> {
    try {
      const privateKeyBuffer = Buffer.from(privateKey, 'hex');

      if (privateKeyBuffer.length !== 32) {
        throw new Error('Chave privada deve ter exatamente 32 bytes (64 caracteres hex)');
      }

      const keyPair = this.ECPair.fromPrivateKey(privateKeyBuffer, { network: this.network });

      let address: string | undefined;

      if (addressType === 'taproot') {
        const xOnlyPubkey = keyPair.publicKey.slice(1, 33);

        if (xOnlyPubkey.length !== 32) {
          throw new Error(`Chave pública X-only inválida: esperado 32 bytes, obtido ${xOnlyPubkey.length} bytes`);
        }

        const { address: taprootAddress } = bitcoin.payments.p2tr({
          internalPubkey: xOnlyPubkey,
          network: this.network
        });

        if (!taprootAddress) {
          throw new Error('Falha ao gerar endereço Taproot: endereço é nulo');
        }

        if (!taprootAddress.startsWith('bc1p')) {
          throw new Error(`Endereço Taproot inválido: deve começar com "bc1p", mas começa com "${taprootAddress.substring(0, 4)}"`);
        }

        if (taprootAddress.length !== 62) {
          throw new Error(`Endereço Taproot inválido: deve ter 62 caracteres, mas tem ${taprootAddress.length} caracteres. Endereço: ${taprootAddress}`);
        }

        address = taprootAddress;
      } else {
        const { address: segwitAddress } = bitcoin.payments.p2wpkh({
          pubkey: keyPair.publicKey,
          network: this.network
        });
        address = segwitAddress;
      }

      if (!address) {
        throw new Error('Falha ao gerar endereço Bitcoin');
      }

      return address;
    } catch (error: any) {
      console.error('Erro em generateAddressFromPrivateKey:', error);
      throw new Error(`Erro ao gerar endereço: ${error.message || error}`);
    }
  }

  private base58Encode(bytes: number[]): string {
    const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

    let num: number[] = [...bytes];
    const result: number[] = [];

    let zeroCount = 0;
    while (zeroCount < bytes.length && bytes[zeroCount] === 0) {
      zeroCount++;
    }

    while (num.length > 0) {
      let remainder = 0;
      const newNum: number[] = [];

      for (let i = 0; i < num.length; i++) {
        const value = remainder * 256 + num[i];
        const quotient = Math.floor(value / 58);
        remainder = value % 58;

        if (newNum.length > 0 || quotient > 0) {
          newNum.push(quotient);
        }
      }

      result.push(remainder);
      num = newNum;
    }

    let resultStr = '';

    for (let i = 0; i < zeroCount; i++) {
      resultStr += '1';
    }

    for (let i = result.length - 1; i >= 0; i--) {
      resultStr += alphabet[result[i]];
    }

    return resultStr;
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  validateSeed(seed: string[]): boolean {
    if (seed.length !== 12) {
      return false;
    }

    for (const word of seed) {
      if (!this.wordList.includes(word.toLowerCase())) {
        return false;
      }
    }

    return true;
  }
}

