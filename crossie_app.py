#!/usr/bin/python

from google.appengine.api.images import *
from google.appengine.ext import db
from google.appengine.api import memcache
from google.appengine.ext import webapp
from google.appengine.ext.webapp.util import run_wsgi_app

import sys
import re
import urllib2
import datetime
import png
import StringIO
import simplejson

class CrossieMetaData(db.Model):
	crossienum = db.IntegerProperty(required=True)
	date = db.DateProperty(required=True)
	metadata = db.TextProperty(required=True)

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
	results = q.fetch(1)

	for md in results:
		memcache.add(date.__str__(), md.metadata)
		return md.metadata

	return None

class GetCrossie(webapp.RequestHandler):
	def get(self):
		self.response.headers['Content-Type'] = 'application/json'
		today = datetime.datetime.today()
		year = today.year
		month = today.month
		day = today.day

		metadata = getmetadatafromDS(year, month, day)
		if metadata is None:
			metadata = fetchpage(year, month, day)

		self.response.out.write(metadata)

application = webapp.WSGIApplication([('/api/v1/getcrossie', GetCrossie)])

if __name__ == "__main__":
	run_wsgi_app(application)
