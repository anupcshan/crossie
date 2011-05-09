#!/usr/bin/python

from google.appengine.api.images import *
from google.appengine.ext import db
from google.appengine.api import memcache
from google.appengine.ext import webapp
from google.appengine.api import users
from google.appengine.api import channel
from google.appengine.ext.webapp.util import run_wsgi_app

import sys
import re
import urllib2
import datetime
import png
import StringIO
import simplejson

class PermissionDeniedException(Exception):
    pass

class NoSuchCrossieException(Exception):
    pass

class CrossieData(db.Model):
    crossienum = db.IntegerProperty(required=True)
    acl = db.ListProperty(users.User, required=True)
    characters = db.StringListProperty(required=True)
    updated = db.DateTimeProperty(required=True, auto_now=True)

    def getJSON(self):
        return simplejson.dumps(self.getData())

    def getData(self):
        return {'crossienum': self.crossienum, 'characters': self.getCharacters(), 'crossieid': self.key().id(), 'updated': self.updated.__str__()}

    def getCharacters(self):
        list = {}
        for i in range(0, len(self.characters)):
            if self.characters[i] != '':
                x, y = divmod(i, 15)
                list[x.__str__() + ',' + y.__str__()] = self.characters[i]
        return list

    @staticmethod
    def getAndUpdateCrossie(crossieid, user, updates):
        crossiedata = CrossieData.get_by_id(crossieid)
        if crossiedata is None:
            # Cannot proceed
            raise NoSuchCrossieException

        if user not in crossiedata.acl:
            raise PermissionDeniedException

        if len(crossiedata.characters) == 0:
            # Populate 15x15 characters with blanks.
            for i in range(0, 225):
                crossiedata.characters.append('')

        for update in updates:
            pos = update['pos'].split(',')
            intpos = int(pos[0])*15 + int(pos[1])
            char = update['char']
            crossiedata.characters[intpos] = char

        crossiedata.put()
        return crossiedata

class UserCrossie(db.Model):
    crossienum = db.IntegerProperty(required=True)
    user = db.UserProperty(required=True)
    crossiedata = db.ReferenceProperty(CrossieData, required=True)

class CrossieMetaData(db.Model):
    crossienum = db.IntegerProperty(required=True)
    date = db.DateProperty(required=True)
    updated = db.DateTimeProperty(required=True, auto_now=True)
    metadata = db.TextProperty(required=True)

class ShareCrossie(db.Model):
    crossienum = db.IntegerProperty(required=True)
    sharer = db.UserProperty(required=True)
    sharee = db.StringProperty(required=True)

def getpixel(img, x, y):
    x = int(x)
    y = int(y)
    return img[y][x * 4]

def fetchpage(year, month, day):
    filename = (((year * 100 + month) * 100) + day) * 100000000 + 99951000
    pageurl = "http://www.hindu.com/thehindu/thscrip/print.pl?file=" + filename.__str__() + ".htm&date=" + year.__str__().zfill(4) + "/" + month.__str__().zfill(2) +"/" + day.__str__().zfill(2) + "/&prd=th&"
    imgurl = "http://www.hindu.com/" + year.__str__().zfill(4) + "/" + month.__str__().zfill(2) +"/" + day.__str__().zfill(2) + "/images/" + (filename + 1).__str__() + ".jpg"

    imgdata = urllib2.urlopen(imgurl).read()
    im = Image(imgdata)
    dimx = im.width
    dimy = im.height

    im.vertical_flip()
    im.vertical_flip()
    temporary = im.execute_transforms(output_encoding=PNG, quality=100)
    test = png.Reader(file=StringIO.StringIO(temporary))
    img = list(test.asRGBA()[2])

    black = 0
    gray = 210
    white = 255
    length = 15
    boxx = dimx*1.0 / length
    boxy = dimy*1.0 / length

    arr = {}
    across = {}
    down = {}
    startlist = {}
    for i in range(0, length):
        arr[i] = {}
        across[i] = {}
        down[i] = {}

    for i in range(0, length):
        for j in range(0, length):
            x = boxx * (i + 0.5) + 0.5
            y = boxy * (j + 0.5) + 0.5
            r = getpixel(img, x, y)
            c0 = abs(r - black)
            c1 = abs(r - gray)
            c2 = abs(r - white)
            if c0 < c1 and c0 < c2:
                clr = black
            elif c1 < c0 and c1 < c2:
                clr = gray
            else:
                clr = white
            if (clr == 255):
                arr[j][i] = 1
            else:
                arr[j][i] = 0

    matrix = []
    for i in range(0, length):
        matrix.append([])
        for j in range(0, length):
            down[i][j] = across[i][j] = 0
            if arr[i][j] == 1:
                down[i][j] = across[i][j] = 1
                matrix[i].append(1)
                if i > 0:
                    down[i][j] = down[i-1][j] + 1
                    if down[i][j] == 2:
                        if startlist.get((i-1, j)):
                            startlist[(i-1, j)] += 1
                        else:
                            startlist[(i-1, j)] = 1
                if j > 0:
                    across[i][j] = across[i][j-1] + 1
                    if across[i][j] == 2:
                        if startlist.get((i, j-1)):
                            startlist[(i, j-1)] += 2
                        else:
                            startlist[(i, j-1)] = 2
            else:
                matrix[i].append(0)

    starts = startlist.keys()
    starts.sort()
    startpos = []

    for startposn in starts:
        startpos.append([startposn[0], startposn[1], startlist[startposn]])

    # Done with image stuff. Now to get the clues.
    page = urllib2.urlopen(pageurl).read().split('\r\n')
    across = {}
    down = {}
    prevcnum = 0
    crossienum = None
    author = None
    isacross = True

    for line in page:
        if crossienum == None:
            if re.match('The Hindu Crossword [^0-9]*[0-9][0-9]*', line):
                crossienum = int(re.search('The Hindu Crossword [^0-9]*([0-9][0-9]*)', line).groups()[0])
        if author == None:
            if re.match('^[a-zA-z][a-zA-Z .]*$', line):
                author = line
        if re.match('<p>\s*[0-9][0-9]*', line):
            cnum, clue, chars = re.search('<p>\s*([0-9][0-9]*)\ (.*) (\([0-9,-]*\))', line).groups()
            cnum = int(cnum)
            if isacross:
                if cnum < prevcnum:
                    isacross = False

            prevcnum = cnum
            if isacross:
                across[cnum] = {'clue': clue, 'chars': chars}
            else:
                down[cnum] = {'clue': clue, 'chars': chars}

    crssie = {}
    crssie['matrix'] = matrix
    crssie['startpos'] = startpos
    crssie['crossienum'] = crossienum
    crssie['author'] = author
    crssie['across'] = across
    crssie['down'] = down
    crssie['date'] = {'year': year, 'month': month, 'day': day}

    metadatajson = simplejson.dumps(crssie)
    crssiemetadata = CrossieMetaData(crossienum=crossienum, date=datetime.date(year, month, day), metadata=metadatajson, key_name=crossienum.__str__())
    crssiemetadata.put()
    memcache.add(datetime.date(year, month, day).__str__(), metadatajson)
    return metadatajson

def getmetadatafromMemcache(year, month, day):
    date = datetime.date(year, month, day)
    metadata = memcache.get(date.__str__())

    if metadata is not None:
        return metadata

    return None

def getmetadatafromDS(year, month, day):
    date = datetime.date(year, month, day)

    metadata = getmetadatafromMemcache(year, month, day)
    if metadata is not None:
        return metadata

    q = CrossieMetaData.all()
    q.filter("date", date)
    md = q.get()

    if md is not None:
        memcache.add(date.__str__(), md.metadata)
        return md.metadata

    return None

class GetCrossieMetaData(webapp.RequestHandler):
    def get(self):
        self.response.headers['Content-Type'] = 'application/json'
        dt = self.request.get('date')
        if dt is not None and len(dt) != 0:
            year, month, day = self.request.get('date').split('-')
            year = int(year)
            month = int(month)
            day = int(day)
        else:
            today = datetime.datetime.today()
            year = today.year
            month = today.month
            day = today.day

        metadata = getmetadatafromDS(year, month, day)
        if metadata is None:
            metadata = fetchpage(year, month, day)

        self.response.out.write(metadata)

class GetCrossieList(webapp.RequestHandler):
    def get(self):
        self.response.headers['Content-Type'] = 'application/json'
        q = CrossieMetaData.all()
        since = self.request.get('since')
        if since is not None and len(since) != 0:
            since, temp = since.split('.')
            since = datetime.datetime.strptime(since, '%Y-%m-%d %H:%M:%S')
            q.filter('updated >=', since)

        list = []

        for md in q:
            list.append({"crossienum": md.crossienum, "date": md.date.__str__()})

        crossielist = {'list': list, 'lastupdated': datetime.datetime.now().__str__()}
        self.response.out.write(simplejson.dumps(crossielist))

class Crossie(webapp.RequestHandler):
    def get(self):
        self.response.headers['Content-Type'] = 'application/json'

        user = users.get_current_user()
        crossienum = self.request.get('crossienum')
        if crossienum is not None and len(crossienum) != 0:
            crossienum = int(crossienum)
            q = UserCrossie.all()
            q.filter('user', user)
            q.filter('crossienum', crossienum)
            usercrossie = q.get()

            if usercrossie is None:
                # FIXME: No transaction model used here.
                crossiedata = CrossieData(crossienum=crossienum, acl=[user])
                crossiedata.put()
                usercrossie = UserCrossie(crossienum=crossienum, user=user, crossiedata=crossiedata)
                usercrossie.put()

            self.response.out.write(usercrossie.crossiedata.getJSON())
            return
        else:
            self.response.out.write(simplejson.dumps({'error': 'Crossienum should specified.'}))

    def post(self):
        self.response.headers['Content-Type'] = 'application/json'

        user = users.get_current_user()
        crossienum = self.request.get('crossienum')
        if crossienum is None or len(crossienum) == 0:
            # Cannot proceed
            self.response.out.write(simplejson.dumps({'error': 'Crossienum should specified.'}))
            return

        crossienum = int(crossienum)
        crossiedata = None
        q = UserCrossie.all()
        q.filter('user', user)
        q.filter('crossienum', crossienum)
        usercrossie = q.get()

        if usercrossie is None:
            # FIXME: No transaction model used here.
            crossiedata = CrossieData(crossienum=crossienum, acl=[user])
            crossiedata.put()
            usercrossie = UserCrossie(crossienum=crossienum, user=user, crossiedata=crossiedata)
            usercrossie.put()

        crossieid = usercrossie.crossiedata.key().id()

        updates = self.request.get('updates')
        if updates is None or len(updates) == 0:
            updates = []
        else:
            updates = simplejson.loads(updates)

        try:
            crossiedata = db.run_in_transaction(CrossieData.getAndUpdateCrossie, crossieid, user, updates)
        except NoSuchCrossieException:
            self.response.out.write(simplejson.dumps({'error': 'Crossie data not found.'}))
            return
        except PermissionDeniedException:
            self.response.out.write(simplejson.dumps({'error': 'Permission denied.'}))
            return
        except db.TransactionFailedError:
            self.response.out.write(simplejson.dumps({'error': 'DB error. Try again.'}))

        if crossiedata is not None:
            self.response.out.write(crossiedata.getJSON())
            for usr in crossiedata.acl:
                if usr != user:
                    try:
                        channel.send_message(usr.email().lower(), simplejson.dumps({'crossieupdate': {'updates': updates, 'crossienum': crossienum}}))
                    except:
                        # Does not matter if all collabs don't get the message
                        pass

class CrossieUpdates(webapp.RequestHandler):
    def get(self):
        self.response.headers['Content-Type'] = 'application/json'

        user = users.get_current_user()
        since = self.request.get('since')
        q = CrossieData.all()
        if since is not None and len(since) != 0:
            since, temp = since.split('.')
            since = datetime.datetime.strptime(since, '%Y-%m-%d %H:%M:%S')
            q.filter('updated >=', since)

        crossies = []
        for crossiedata in q:
            if user in crossiedata.acl:
                crossies.append(crossiedata)

        # FIXME: Below is a *very nasty* hack to make JSONifying CrossieData
        # work properly. Look away.
        self.response.out.write(simplejson.dumps([crossie.getData() for crossie in crossies]))

class Channel(webapp.RequestHandler):
    def get(self):
        self.response.headers['Content-Type'] = 'application/json'

        user = users.get_current_user()
        token = channel.create_channel(user.email().lower())
        self.response.out.write(simplejson.dumps({'token': token}))

class Share(webapp.RequestHandler):
    def post(self):
        self.response.headers['Content-Type'] = 'application/json'

        user = users.get_current_user()
        crossienum = self.request.get('crossienum')
        if crossienum is None or len(crossienum) == 0:
            # Cannot proceed
            self.response.out.write(simplejson.dumps({'error': 'Crossienum should specified.'}))
            return

        sharee = self.request.get('sharedWith')
        if sharee is None or len(sharee) == 0:
            # Cannot proceed
            self.response.out.write(simplejson.dumps({'error': 'SharedWith should specified.'}))
            return

        crossienum = int(crossienum)
        q = UserCrossie.all()
        q.filter('user', user)
        q.filter('crossienum', crossienum)
        usercrossie = q.get()

        if usercrossie is None:
            # Cannot proceed
            self.response.out.write(simplejson.dumps({'error': 'This crossie does not exist.'}))
            return

        sharee = sharee.lower()
        # Check if already shared with this user.
        q = ShareCrossie.all()
        q.filter('sharer', user)
        q.filter('sharee', sharee)
        q.filter('crossienum', crossienum)
        previousshares = q.get()
        if previousshares is not None:
            # Cannot proceed
            self.response.out.write(simplejson.dumps({'error': 'Pending invite exists.'}))
            return

        for usr in usercrossie.crossiedata.acl:
            if usr.email().lower() == sharee:
                # Cannot proceed
                self.response.out.write(simplejson.dumps({'error': 'User already in ACL list.'}))
                return

        sharecrossie = ShareCrossie(sharer=user, sharee=sharee, crossienum=crossienum)
        sharecrossie.put()
        try:
            channel.send_message(sharee, simplejson.dumps({'sharedcrossie': {'shareId': sharecrossie.key().id(), 'sharer': user.email(), 'crossienum': crossienum}}))
        except:
            # Does not matter if sharee gets the message right away.
            pass
        self.response.out.write(simplejson.dumps({'shareId': sharecrossie.key().id()}))

class ShareList(webapp.RequestHandler):
    def get(self):
        self.response.headers['Content-Type'] = 'application/json'

        user = users.get_current_user()

        q = ShareCrossie.all()
        q.filter('sharee', user.email().lower())
        sharedWithMe = []
        for share in q:
            sharedWithMe.append({'shareId': share.key().id(), 'sharer': share.sharer.email(), 'crossienum': share.crossienum})

        q = ShareCrossie.all()
        q.filter('sharer', user)
        pendinginvites = []
        for share in q:
            pendinginvites.append({'shareId': share.key().id(), 'sharee': share.sharee, 'crossienum': share.crossienum})

        self.response.out.write(simplejson.dumps({'sharedWithMe': sharedWithMe, 'pendinginvites': pendinginvites}))

class AcceptShare(webapp.RequestHandler):
    def post(self):
        self.response.headers['Content-Type'] = 'application/json'

        user = users.get_current_user()
        shareId = self.request.get('shareId')
        if shareId is None or len(shareId) == 0:
            # Cannot proceed
            self.response.out.write(simplejson.dumps({'error': 'ShareId should specified.'}))
            return

        shareId = long(shareId)
        sharecrossie = ShareCrossie.get_by_id(shareId)
        if sharecrossie is None:
            # Cannot proceed
            self.response.out.write(simplejson.dumps({'error': 'Shared crossie does not exist.'}))
            return

        if sharecrossie.sharee != user.email().lower():
            # Cannot proceed
            self.response.out.write(simplejson.dumps({'error': 'No permission to access shared crossie.'}))
            return

        q = UserCrossie.all()
        q.filter('user', sharecrossie.sharer)
        q.filter('crossienum', sharecrossie.crossienum)
        usercrossie = q.get()

        if usercrossie is None:
            # Cannot proceed
            self.response.out.write(simplejson.dumps({'error': 'This crossie does not exist.'}))
            return

        for usr in usercrossie.crossiedata.acl:
            if usr == user:
                # Cannot proceed
                self.response.out.write(simplejson.dumps({'error': 'User already in ACL list.'}))
                sharecrossie.delete()
                return

        # FIXME: The following code should be done in a single transaction. Can screw up.
        usercrossie.crossiedata.acl.append(user)
        usercrossie.crossiedata.put()
        crossiedata = usercrossie.crossiedata

        q = UserCrossie.all()
        q.filter('user', user)
        q.filter('crossienum', sharecrossie.crossienum)
        usercrossie = q.get()

        if usercrossie is None:
            usercrossie = UserCrossie(crossienum=sharecrossie.crossienum, user=user, crossiedata=crossiedata)
            usercrossie.put()
        else:
            usercrossie.crossiedata = crossiedata
            usercrossie.put()

        sharecrossie.delete()
        self.response.out.write(simplejson.dumps({'success': 1, 'crossie': crossiedata.getData()}))

application = webapp.WSGIApplication([('/api/v1/getcrossiemetadata', GetCrossieMetaData),
        ('/api/v1/getcrossielist', GetCrossieList), ('/api/v1/crossie', Crossie),
        ('/api/v1/crossieupdates', CrossieUpdates), ('/api/v1/channel', Channel),
        ('/api/v1/share', Share), ('/api/v1/sharelist', ShareList),
        ('/api/v1/share/accept', AcceptShare)])

if __name__ == "__main__":
    run_wsgi_app(application)
